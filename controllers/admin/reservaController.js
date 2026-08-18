const Configuracion = require('../../models/Configuracion');
const Ejemplar = require('../../models/Ejemplar');
const Prestamo = require('../../models/Prestamo');
const Recurso = require('../../models/Recurso');
const Reserva = require('../../models/Reserva');
const Sancion = require('../../models/Sancion');
const Usuario = require('../../models/Usuario');
const reservaService = require('../../services/reservaService');
const notifService = require('../../services/notificacionService');
const { esAjax, ok, fail } = require('../../utils/responder');

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + Number(days || 0));
  return result;
}

async function agruparReservasActivas() {
  const reservas = await Reserva.find({
    estado: { $in: ['Pendiente', 'Disponible para reclamar'] }
  }).sort({ recurso_titulo: 1, posicion: 1 }).lean();

  const grupos = new Map();
  reservas.forEach((reserva) => {
    const key = String(reserva.recurso_id);
    if (!grupos.has(key)) {
      grupos.set(key, {
        recurso_id: reserva.recurso_id,
        recurso_titulo: reserva.recurso_titulo,
        recurso_imagen: reserva.recurso_imagen,
        tipo: reserva.tipo,
        reservas: []
      });
    }
    grupos.get(key).reservas.push(reserva);
  });

  return Array.from(grupos.values());
}

async function calcularProximaDisponibilidad(recursoId) {
  const prestamos = await Prestamo.find({
    estado: { $in: ['Activo', 'Vencido', 'Parcialmente devuelto'] },
    items: { $elemMatch: { recurso_id: recursoId, estado: { $in: ['Activo', 'Vencido'] } } }
  }).select('items').lean();

  let proxima = null;
  prestamos.forEach((prestamo) => {
    (prestamo.items || []).forEach((item) => {
      if (String(item.recurso_id) === String(recursoId) && ['Activo', 'Vencido'].includes(item.estado)) {
        if (!proxima || item.fecha_limite < proxima) proxima = item.fecha_limite;
      }
    });
  });

  return proxima;
}

async function enriquecerGrupo(grupo) {
  const recurso = await Recurso.findById(grupo.recurso_id).lean();
  const proximaDisponibilidad = await calcularProximaDisponibilidad(grupo.recurso_id);

  return {
    ...grupo,
    autor: recurso?.autor || '',
    isbn: recurso?.isbn || '',
    total_ejemplares: recurso?.fisico?.total_ejemplares || 0,
    disponibles: recurso?.fisico?.ejemplares_disponibles || 0,
    proxima_disponibilidad: proximaDisponibilidad,
    en_espera: grupo.reservas.filter((r) => r.estado === 'Pendiente').length,
    disponibles_para_reclamar: grupo.reservas.filter((r) => r.estado === 'Disponible para reclamar').length
  };
}

exports.index = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const tipo = String(req.query.tipo || '').trim();
    const estado = String(req.query.estado || '').trim();

    let grupos = await agruparReservasActivas();
    grupos = await Promise.all(grupos.map(enriquecerGrupo));

    if (tipo) grupos = grupos.filter((g) => g.tipo === tipo);
    if (estado === 'Pendiente') grupos = grupos.filter((g) => g.en_espera > 0);
    if (estado === 'Disponible para reclamar') grupos = grupos.filter((g) => g.disponibles_para_reclamar > 0);
    if (q) {
      grupos = grupos.filter((g) => {
        const enTitulo = g.recurso_titulo.toLowerCase().includes(q);
        const enAutor = (g.autor || '').toLowerCase().includes(q);
        const enUsuario = g.reservas.some((r) => (r.usuario_nombre || '').toLowerCase().includes(q)
          || (r.usuario_documento || '').toLowerCase().includes(q));
        return enTitulo || enAutor || enUsuario;
      });
    }

    const limitesPermitidos = [10, 20, 50];
    let limite = parseInt(req.query.limite, 10);
    if (!limitesPermitidos.includes(limite)) limite = 10;

    const totalRegistros = grupos.length;
    const totalPaginas = Math.max(Math.ceil(totalRegistros / limite), 1);

    let pagina = parseInt(req.query.pagina, 10) || 1;
    if (pagina < 1) pagina = 1;
    if (pagina > totalPaginas) pagina = totalPaginas;

    const gruposPagina = grupos.slice((pagina - 1) * limite, pagina * limite);

    const datos = {
      grupos: gruposPagina,
      filtros: { q: req.query.q || '', tipo, estado },
      paginacion: { pagina, totalPaginas, limite, totalRegistros, limitesPermitidos }
    };

    // Petición de nuestro fetch(): solo el fragmento (tarjetas + panel de
    // detalle), sin layout ni el encabezado/toolbar (evita recargar todo).
    if (esAjax(req)) {
      return res.render('admin/reservas/_shell', Object.assign({ layout: false }, datos));
    }

    res.render('admin/reservas/index', Object.assign({
      title: 'Reservas',
      pageClass: 'admin-reservas-page'
    }, datos));
  } catch (error) {
    next(error);
  }
};

exports.nueva = async (req, res, next) => {
  try {
    const [usuarios, recursos] = await Promise.all([
      Usuario.find({ estado: 'Activo' }).sort({ nombre: 1 }).lean(),
      Recurso.find({
        estado: 'Activo',
        tipo_naturaleza: { $in: ['Físico', 'Mixto'] }
      }).sort({ titulo: 1 }).lean()
    ]);

    res.render('admin/reservas/nueva', {
      title: 'Nueva reserva',
      usuarios,
      recursos,
      pageClass: 'admin-reservas-page'
    });
  } catch (error) {
    next(error);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const volver = '/admin/reservas/nueva';

    const [usuario, recurso, config] = await Promise.all([
      Usuario.findById(req.body.usuario_id),
      Recurso.findById(req.body.recurso_id),
      Configuracion.findOne().lean()
    ]);

    if (!usuario || usuario.estado !== 'Activo') {
      return fail(req, res, { redirect: volver, message: 'El usuario no está activo o no existe.' });
    }

    if (!recurso) {
      return fail(req, res, { redirect: volver, message: 'El recurso no existe.' });
    }

    const now = new Date();
    const tieneSancionBloqueante = await Sancion.exists({
      usuario_id: usuario._id,
      estado: 'Activa',
      tipo_sancion: { $ne: 'Advertencia' },
      $or: [
        { tipo_sancion: 'Suspensión', fecha_fin: { $gt: now } },
        { tipo_sancion: 'Reposición', reposicion_confirmada: { $ne: true } },
        { tipo_sancion: 'Reposición', reposicion_confirmada: true, fecha_fin: { $gt: now } }
      ]
    });
    if (tieneSancionBloqueante) {
      return fail(req, res, { redirect: volver, message: 'El usuario tiene sanciones activas.' });
    }

    const maxReservas = config?.reservas?.max_reservas_por_usuario || 3;
    if ((usuario.reservas_activas || 0) >= maxReservas) {
      return fail(req, res, { redirect: volver, message: `El usuario supera el máximo de ${maxReservas} reservas activas.` });
    }

    const reservaDuplicada = await Reserva.exists({
      usuario_id: usuario._id,
      recurso_id: recurso._id,
      estado: { $in: ['Pendiente', 'Disponible para reclamar'] }
    });
    if (reservaDuplicada) {
      return fail(req, res, { redirect: volver, message: 'El usuario ya tiene una reserva activa sobre este recurso.' });
    }

    const yaTieneRecurso = await Prestamo.exists({
      usuario_id: usuario._id,
      estado: { $in: ['Activo', 'Parcialmente devuelto', 'Vencido'] },
      items: {
        $elemMatch: {
          recurso_id: recurso._id,
          estado: { $in: ['Activo', 'Vencido'] }
        }
      }
    });
    if (yaTieneRecurso) {
      return fail(req, res, { redirect: volver, message: 'El usuario ya tiene un préstamo activo de este recurso.' });
    }

    const ejemplaresDisponibles = await Ejemplar.countDocuments({
      recurso_id: recurso._id,
      estado: 'Disponible'
    });
    if (ejemplaresDisponibles > 0) {
      return fail(req, res, { redirect: volver, message: 'Solo se pueden reservar recursos sin disponibilidad inmediata.' });
    }

    await reservaService.crearReserva({
      usuario,
      recurso,
      tipo: 'Físico',
      registradoPor: req.session.adminId
    });

    usuario.reservas_activas = (usuario.reservas_activas || 0) + 1;
    usuario.actualizado_en = new Date();
    await usuario.save();
    await Recurso.findByIdAndUpdate(recurso._id, { $inc: { total_reservas: 1 }, actualizado_en: new Date() });

    return ok(req, res, {
      redirect: '/admin/reservas',
      message: 'Reserva registrada correctamente.',
      extra: { redirectTo: '/admin/reservas' }
    });
  } catch (error) {
    next(error);
  }
};

exports.cancelar = async (req, res, next) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) {
      return fail(req, res, { redirect: '/admin/reservas', message: 'La reserva no existe.' });
    }

    reserva.estado = 'Cancelada';
    reserva.fecha_resolucion = new Date();
    reserva.cancelada_por = 'administrador';
    reserva.motivo_cancelacion = req.body.motivo_cancelacion || 'Cancelada por administrador';
    reserva.actualizado_en = new Date();
    await reserva.save();

    await Usuario.findByIdAndUpdate(reserva.usuario_id, {
      $inc: { reservas_activas: -1 },
      actualizado_en: new Date()
    });

    return ok(req, res, { redirect: '/admin/reservas', message: 'Reserva cancelada.' });
  } catch (error) {
    next(error);
  }
};

exports.liberar = async (req, res, next) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva || reserva.estado !== 'Pendiente') {
      return fail(req, res, { redirect: '/admin/reservas', message: 'Solo se puede liberar una reserva pendiente.' });
    }

    await reservaService.marcarDisponible(reserva, req.session.adminId);
    return ok(req, res, { redirect: '/admin/reservas', message: 'Turno marcado como disponible para reclamar.' });
  } catch (error) {
    next(error);
  }
};

exports.procesar = async (req, res, next) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva || reserva.estado !== 'Disponible para reclamar') {
      return fail(req, res, { redirect: '/admin/reservas', message: 'La reserva no está disponible para reclamar.' });
    }

    const ejemplar = await Ejemplar.findOne({ recurso_id: reserva.recurso_id, estado: 'Disponible' });
    if (!ejemplar) {
      return fail(req, res, { redirect: '/admin/reservas', message: 'No hay ejemplares disponibles para procesar esta reserva.' });
    }

    const usuario = await Usuario.findById(reserva.usuario_id);
    const yaTieneRecurso = await Prestamo.exists({
      usuario_id: reserva.usuario_id,
      estado: { $in: ['Activo', 'Parcialmente devuelto', 'Vencido'] },
      items: {
        $elemMatch: {
          recurso_id: reserva.recurso_id,
          estado: { $in: ['Activo', 'Vencido'] }
        }
      }
    });
    if (yaTieneRecurso) {
      return fail(req, res, { redirect: '/admin/reservas', message: 'El usuario ya tiene un préstamo activo de este recurso.' });
    }

    const config = await Configuracion.findOne().lean();
    const now = new Date();
    const dias = config?.prestamos_fisicos?.dias_prestamo_defecto || 15;
    const diasTolerancia = config?.prestamos_fisicos?.dias_tolerancia || 0;

    const prestamo = await Prestamo.create({
      usuario_id: usuario._id,
      usuario_nombre: usuario.nombre,
      usuario_documento: usuario.documento,
      registrado_por: req.session.adminId,
      tipo: 'Físico',
      items: [{
        recurso_id: reserva.recurso_id,
        recurso_titulo: reserva.recurso_titulo,
        ejemplar_id: ejemplar._id,
        codigo_inventario: ejemplar.codigo_inventario,
        formato_tipo: null,
        fecha_inicio: now,
        fecha_limite: addDays(now, dias),
        dias_tolerancia: diasTolerancia,
        estado: 'Activo',
        renovado: false,
        devolucion: {}
      }],
      estado: 'Activo',
      creado_en: now,
      actualizado_en: now
    });

    ejemplar.estado = 'Prestado';
    ejemplar.historial_estados.push({
      estado_anterior: 'Disponible',
      estado_nuevo: 'Prestado',
      cambiado_por: req.session.adminId,
      cambiado_en: now,
      observacion: `Préstamo generado desde reserva ${reserva._id}`
    });
    await ejemplar.save();

    reserva.estado = 'Completada';
    reserva.fecha_resolucion = now;
    reserva.prestamo_generado_id = prestamo._id;
    reserva.actualizado_en = now;
    await reserva.save();

    await Promise.all([
      Usuario.findByIdAndUpdate(usuario._id, {
        $inc: { reservas_activas: -1, prestamos_activos: 1 },
        actualizado_en: now
      }),
      Recurso.findByIdAndUpdate(reserva.recurso_id, {
        $inc: { 'fisico.ejemplares_disponibles': -1, total_prestamos: 1 },
        actualizado_en: now
      })
    ]);

    // Notificar al usuario (préstamo físico aprobado/procesado desde reserva)
    try {
      await notifService.prestamoAprobado(usuario, prestamo, [reserva.recurso_titulo]);
    } catch (_e) { }

    // Este flujo SÍ cambia de sección (termina en la ficha del préstamo),
    // por eso extra.redirectTo le pide al cliente navegar de página completa.
    return ok(req, res, {
      redirect: `/admin/prestamos/${prestamo._id}`,
      message: 'Reserva procesada y préstamo generado.',
      extra: { redirectTo: `/admin/prestamos/${prestamo._id}` }
    });
  } catch (error) {
    next(error);
  }
};

exports.notificar = async (req, res, next) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) {
      return fail(req, res, { redirect: '/admin/reservas', message: 'La reserva no existe.' });
    }

    const usuario = await Usuario.findById(reserva.usuario_id);
    if (usuario) {
      await notifService.recordatorioReserva(usuario, reserva);
    }

    // No cambia ningún estado: no hace falta refrescar la lista.
    return ok(req, res, { redirect: '/admin/reservas', message: `Se notificó a ${reserva.usuario_nombre}.` });
  } catch (error) {
    next(error);
  }
};

exports.notificarTodos = async (req, res, next) => {
  try {
    const reservas = await Reserva.find({
      recurso_id: req.params.recursoId,
      estado: { $in: ['Pendiente', 'Disponible para reclamar'] }
    });

    let notificados = 0;
    for (const reserva of reservas) {
      const usuario = await Usuario.findById(reserva.usuario_id);
      if (usuario) {
        try {
          await notifService.recordatorioReserva(usuario, reserva);
          notificados += 1;
        } catch (_e) { /* continua con los demás */ }
      }
    }

    return ok(req, res, { redirect: '/admin/reservas', message: `Se notificó a ${notificados} usuario(s) en la cola.` });
  } catch (error) {
    next(error);
  }
};
