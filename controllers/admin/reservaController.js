const Configuracion = require('../../models/Configuracion');
const Ejemplar = require('../../models/Ejemplar');
const Prestamo = require('../../models/Prestamo');
const Recurso = require('../../models/Recurso');
const Reserva = require('../../models/Reserva');
const Sancion = require('../../models/Sancion');
const Usuario = require('../../models/Usuario');
const reservaService = require('../../services/reservaService');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

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

exports.index = async (req, res, next) => {
  try {
    const grupos = await agruparReservasActivas();
    res.render('admin/reservas/index', { title: 'Reservas', grupos });
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
      recursos
    });
  } catch (error) {
    next(error);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const [usuario, recurso, config] = await Promise.all([
      Usuario.findById(req.body.usuario_id),
      Recurso.findById(req.body.recurso_id),
      Configuracion.findOne().lean()
    ]);

    if (!usuario || usuario.estado !== 'Activo') {
      flash(req, 'error', 'El usuario no está activo o no existe.');
      return res.redirect('/admin/reservas/nueva');
    }

    if (!recurso) {
      flash(req, 'error', 'El recurso no existe.');
      return res.redirect('/admin/reservas/nueva');
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
      flash(req, 'error', 'El usuario tiene sanciones activas.');
      return res.redirect('/admin/reservas/nueva');
    }

    const maxReservas = config?.reservas?.max_reservas_por_usuario || 3;
    if ((usuario.reservas_activas || 0) >= maxReservas) {
      flash(req, 'error', `El usuario supera el máximo de ${maxReservas} reservas activas.`);
      return res.redirect('/admin/reservas/nueva');
    }

    const reservaDuplicada = await Reserva.exists({
      usuario_id: usuario._id,
      recurso_id: recurso._id,
      estado: { $in: ['Pendiente', 'Disponible para reclamar'] }
    });
    if (reservaDuplicada) {
      flash(req, 'error', 'El usuario ya tiene una reserva activa sobre este recurso.');
      return res.redirect('/admin/reservas/nueva');
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
      flash(req, 'error', 'El usuario ya tiene un prÃ©stamo activo de este recurso.');
      return res.redirect('/admin/reservas/nueva');
    }

    const ejemplaresDisponibles = await Ejemplar.countDocuments({
      recurso_id: recurso._id,
      estado: 'Disponible'
    });
    if (ejemplaresDisponibles > 0) {
      flash(req, 'error', 'Solo se pueden reservar recursos sin disponibilidad inmediata.');
      return res.redirect('/admin/reservas/nueva');
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

    flash(req, 'success', 'Reserva registrada correctamente.');
    return res.redirect('/admin/reservas');
  } catch (error) {
    next(error);
  }
};

exports.cancelar = async (req, res, next) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) {
      flash(req, 'error', 'La reserva no existe.');
      return res.redirect('/admin/reservas');
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

    flash(req, 'success', 'Reserva cancelada.');
    return res.redirect('/admin/reservas');
  } catch (error) {
    next(error);
  }
};

exports.liberar = async (req, res, next) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva || reserva.estado !== 'Pendiente') {
      flash(req, 'error', 'Solo se puede liberar una reserva pendiente.');
      return res.redirect('/admin/reservas');
    }

    await reservaService.marcarDisponible(reserva, req.session.adminId);
    flash(req, 'success', 'Turno marcado como disponible para reclamar.');
    return res.redirect('/admin/reservas');
  } catch (error) {
    next(error);
  }
};

exports.procesar = async (req, res, next) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva || reserva.estado !== 'Disponible para reclamar') {
      flash(req, 'error', 'La reserva no está disponible para reclamar.');
      return res.redirect('/admin/reservas');
    }

    const ejemplar = await Ejemplar.findOne({ recurso_id: reserva.recurso_id, estado: 'Disponible' });
    if (!ejemplar) {
      flash(req, 'error', 'No hay ejemplares disponibles para procesar esta reserva.');
      return res.redirect('/admin/reservas');
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
      flash(req, 'error', 'El usuario ya tiene un prÃ©stamo activo de este recurso.');
      return res.redirect('/admin/reservas');
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

    flash(req, 'success', 'Reserva procesada y préstamo generado.');
    return res.redirect(`/admin/prestamos/${prestamo._id}`);
  } catch (error) {
    next(error);
  }
};
