const mongoose = require('mongoose');
const notifService = require('../../services/notificacionService');
const { validationResult } = require('express-validator');
const Configuracion = require('../../models/Configuracion');
const Ejemplar = require('../../models/Ejemplar');
const Prestamo = require('../../models/Prestamo');
const Recurso = require('../../models/Recurso');
const Sancion = require('../../models/Sancion');
const Usuario = require('../../models/Usuario');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + Number(days || 0));
  return result;
}

function calcularDiasPrestamo(config, recurso) {
  const fisicos = config?.prestamos_fisicos || {};
  const defaultDays = fisicos.dias_prestamo_defecto || 15;
  const categoria = recurso.categorias?.[0];
  if (!categoria) return defaultDays;

  const categoriaConfig = (fisicos.tiempos_por_categoria || []).find((item) => (
    String(item.categoria_id) === String(categoria.categoria_id)
  ));
  if (!categoriaConfig) return defaultDays;

  const subConfig = (categoriaConfig.subcategorias || []).find((item) => (
    String(item.subcategoria_id) === String(categoria.subcategoria_id)
  ));

  return subConfig?.dias || categoriaConfig.dias || defaultDays;
}

async function actualizarEstadosVencidos() {
  const prestamos = await Prestamo.find({
    estado: { $in: ['Activo', 'Parcialmente devuelto'] },
    'items.estado': 'Activo',
    'items.fecha_limite': { $lt: new Date() }
  });

  for (const prestamo of prestamos) {
    let changed = false;
    prestamo.items.forEach((item) => {
      if (item.estado === 'Activo' && item.fecha_limite < new Date()) {
        item.estado = 'Vencido';
        changed = true;
      }
    });
    if (changed) {
      prestamo.estado = 'Vencido';
      await prestamo.save();
    }
  }
}

exports.index = async (req, res, next) => {
  try {
    await actualizarEstadosVencidos();
    const q = String(req.query.q || '').trim();
    const estado = String(req.query.estado || '').trim();
    const filtro = {};

    if (estado) filtro.estado = estado;
    else filtro.estado = { $ne: 'Devuelto' };

    if (q) {
      filtro.$or = [
        { usuario_nombre: new RegExp(q, 'i') },
        { usuario_documento: new RegExp(q, 'i') },
        { 'items.recurso_titulo': new RegExp(q, 'i') },
        { 'items.codigo_inventario': new RegExp(q, 'i') }
      ];
    }

    const prestamos = await Prestamo.find(filtro).sort({ creado_en: -1 }).lean();
    res.render('admin/prestamos/index', {
      title: 'Préstamos activos',
      prestamos,
      filtros: { q, estado }
    });
  } catch (error) {
    next(error);
  }
};

exports.historial = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const filtro = q
      ? {
        $or: [
          { usuario_nombre: new RegExp(q, 'i') },
          { usuario_documento: new RegExp(q, 'i') },
          { 'items.recurso_titulo': new RegExp(q, 'i') }
        ]
      }
      : {};
    const prestamos = await Prestamo.find(filtro).sort({ creado_en: -1 }).lean();
    res.render('admin/prestamos/historial', { title: 'Historial de préstamos', prestamos, q });
  } catch (error) {
    next(error);
  }
};

exports.nuevo = async (req, res, next) => {
  try {
    const [usuarios, ejemplares] = await Promise.all([
      Usuario.find({ estado: 'Activo' }).sort({ nombre: 1 }).lean(),
      Ejemplar.find({ estado: 'Disponible' }).sort({ recurso_titulo: 1, codigo_inventario: 1 }).lean()
    ]);

    res.render('admin/prestamos/nuevo', {
      title: 'Nuevo préstamo',
      usuarios,
      ejemplares
    });
  } catch (error) {
    next(error);
  }
};

exports.detalle = async (req, res, next) => {
  try {
    const prestamo = await Prestamo.findById(req.params.id).lean();
    if (!prestamo) {
      flash(req, 'error', 'El préstamo no existe.');
      return res.redirect('/admin/prestamos');
    }
    return res.render('admin/prestamos/detalle', { title: 'Detalle préstamo', prestamo });
  } catch (error) {
    next(error);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      flash(req, 'error', errors.array()[0].msg);
      return res.redirect('/admin/prestamos/nuevo');
    }

    const usuario = await Usuario.findById(req.body.usuario_id);
    if (!usuario || usuario.estado !== 'Activo') {
      flash(req, 'error', 'El usuario no está activo o no existe.');
      return res.redirect('/admin/prestamos/nuevo');
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
      return res.redirect('/admin/prestamos/nuevo');
    }

    const config = await Configuracion.findOne().lean();
    const maxRecursos = config?.prestamos_fisicos?.max_recursos_por_usuario || 3;
    const selectedIds = asArray(req.body.ejemplar_ids).filter(mongoose.isValidObjectId);

    if (usuario.prestamos_activos + selectedIds.length > maxRecursos) {
      flash(req, 'error', `El usuario supera el máximo de ${maxRecursos} recursos activos.`);
      return res.redirect('/admin/prestamos/nuevo');
    }

    const ejemplares = await Ejemplar.find({ _id: { $in: selectedIds }, estado: 'Disponible' });
    if (ejemplares.length !== selectedIds.length) {
      flash(req, 'error', 'Uno o más ejemplares ya no están disponibles.');
      return res.redirect('/admin/prestamos/nuevo');
    }

    const recursoIdsSeleccionados = [...new Set(ejemplares.map((ejemplar) => String(ejemplar.recurso_id)))];
    const yaTieneRecurso = await Prestamo.exists({
      usuario_id: usuario._id,
      estado: { $in: ['Activo', 'Parcialmente devuelto', 'Vencido'] },
      items: {
        $elemMatch: {
          recurso_id: { $in: recursoIdsSeleccionados },
          estado: { $in: ['Activo', 'Vencido'] }
        }
      }
    });
    if (yaTieneRecurso) {
      flash(req, 'error', 'El usuario ya tiene un prÃ©stamo activo de uno de los recursos seleccionados.');
      return res.redirect('/admin/prestamos/nuevo');
    }

    const recursos = await Recurso.find({ _id: { $in: ejemplares.map((ejemplar) => ejemplar.recurso_id) } }).lean();
    const recursoMap = new Map(recursos.map((recurso) => [String(recurso._id), recurso]));
    const diasTolerancia = config?.prestamos_fisicos?.dias_tolerancia || 0;

    const items = ejemplares.map((ejemplar) => {
      const recurso = recursoMap.get(String(ejemplar.recurso_id));
      const dias = calcularDiasPrestamo(config, recurso || {});
      return {
        recurso_id: ejemplar.recurso_id,
        recurso_titulo: ejemplar.recurso_titulo,
        ejemplar_id: ejemplar._id,
        codigo_inventario: ejemplar.codigo_inventario,
        formato_tipo: null,
        fecha_inicio: now,
        fecha_limite: addDays(now, dias),
        fecha_devolucion_real: null,
        dias_tolerancia: diasTolerancia,
        estado: 'Activo',
        renovado: false,
        devolucion: {}
      };
    });

    const prestamo = await Prestamo.create({
      usuario_id: usuario._id,
      usuario_nombre: usuario.nombre,
      usuario_documento: usuario.documento,
      registrado_por: req.session.adminId,
      tipo: 'Físico',
      items,
      estado: 'Activo',
      tiene_sancion: false,
      creado_en: now,
      actualizado_en: now
    });

    for (const ejemplar of ejemplares) {
      ejemplar.historial_estados.push({
        estado_anterior: ejemplar.estado,
        estado_nuevo: 'Prestado',
        cambiado_por: req.session.adminId,
        cambiado_en: now,
        observacion: `Préstamo registrado al usuario ${usuario.documento}`
      });
      ejemplar.estado = 'Prestado';
      ejemplar.actualizado_en = now;
      await ejemplar.save();
    }

    await Promise.all([
      Usuario.findByIdAndUpdate(usuario._id, { $inc: { prestamos_activos: items.length }, actualizado_en: now }),
      ...recursos.map((recurso) => Recurso.findByIdAndUpdate(recurso._id, {
        $inc: {
          'fisico.ejemplares_disponibles': -ejemplares.filter((ejemplar) => String(ejemplar.recurso_id) === String(recurso._id)).length,
          total_prestamos: ejemplares.filter((ejemplar) => String(ejemplar.recurso_id) === String(recurso._id)).length
        },
        actualizado_en: now
      }))
    ]);

    // Notificar al usuario (préstamo aprobado)
    try {
      const Usuario = require('../../models/Usuario');
      const usuarioDoc = await Usuario.findById(prestamo.usuario_id).lean();
      if (usuarioDoc) {
        const titulos = prestamo.items.map(i => i.recurso_titulo);
        await notifService.prestamoAprobado(usuarioDoc, prestamo, titulos);
      }
    } catch (_e) { }
    flash(req, 'success', 'Préstamo registrado correctamente.');
    return res.redirect(`/admin/prestamos/${prestamo._id}`);
  } catch (error) {
    next(error);
  }
};

exports.renovar = async (req, res, next) => {
  try {
    const prestamo = await Prestamo.findById(req.params.id);
    const item = prestamo?.items.id(req.body.item_id);
    const config = await Configuracion.findOne().lean();

    if (!prestamo || !item) {
      flash(req, 'error', 'Ítem de préstamo no encontrado.');
      return res.redirect('/admin/prestamos');
    }

    if (item.estado !== 'Activo' || item.renovado) {
      flash(req, 'error', 'Este ítem no puede renovarse.');
      return res.redirect(`/admin/prestamos/${prestamo._id}`);
    }

    item.renovado = true;
    item.fecha_renovacion = new Date();
    item.nueva_fecha_limite = addDays(item.fecha_limite, config?.prestamos_fisicos?.dias_renovacion || 7);
    item.fecha_limite = item.nueva_fecha_limite;
    item.renovado_por = req.session.adminId;
    await prestamo.save();

    flash(req, 'success', 'Renovación registrada.');
    return res.redirect(`/admin/prestamos/${prestamo._id}`);
  } catch (error) {
    next(error);
  }
};

exports.confirmarReposicion = async (req, res, next) => {
  try {
    const Administrador = require('../../models/Administrador');
    const prestamo = await Prestamo.findById(req.params.id);
    if (!prestamo) {
      flash(req, 'error', 'El préstamo no existe.');
      return res.redirect('/admin/prestamos');
    }

    const now = new Date();
    let repuestosCount = 0;

    // 1. Marcar ítems perdidos como devueltos
    for (const item of prestamo.items) {
      if (item.estado === 'Perdido') {
        item.estado = 'Devuelto';
        item.fecha_devolucion_real = now;
        repuestosCount++;

        // 2. Dar de alta el ejemplar en inventario
        const ejemplar = await Ejemplar.findById(item.ejemplar_id);
        if (ejemplar) {
          ejemplar.historial_estados.push({
            estado_anterior: ejemplar.estado,
            estado_nuevo: 'Disponible',
            cambiado_por: req.session.adminId,
            cambiado_en: now,
            observacion: 'Reposición confirmada por administrador. Ejemplar habilitado.'
          });
          ejemplar.estado = 'Disponible';
          ejemplar.actualizado_en = now;
          await ejemplar.save();
        }

        // 3. Incrementar ejemplares disponibles del Recurso
        await Recurso.findByIdAndUpdate(item.recurso_id, {
          $inc: { 'fisico.ejemplares_disponibles': 1 },
          actualizado_en: now
        });
      }
    }

    if (repuestosCount === 0) {
      flash(req, 'error', 'No se encontraron ítems pendientes de reposición en este préstamo.');
      return res.redirect(`/admin/prestamos/${prestamo._id}`);
    }

    // 4. Actualizar estado del préstamo
    prestamo.estado = estadoGeneral(prestamo.items);
    prestamo.actualizado_en = now;
    await prestamo.save();

    // 5. Levantar o actualizar la sanción del usuario
    const sancion = await Sancion.findOne({
      prestamo_id: prestamo._id,
      tipo_sancion: 'Reposición',
      estado: 'Activa'
    });

    if (sancion) {
      sancion.reposicion_confirmada = true;
      sancion.actualizado_en = now;

      // Verificar si hay suspensión adicional pendiente
      const tieneSuspensionActiva = sancion.fecha_fin && new Date(sancion.fecha_fin) > now;
      if (!tieneSuspensionActiva) {
        // Levantar la sanción si no hay suspensión adicional pendiente
        sancion.estado = 'Levantada';
        sancion.fecha_levantamiento = now;
        sancion.motivo_levantamiento = 'Reposición de material confirmada';
        sancion.levantada_por = req.session.adminId;
        const admin = await Administrador.findById(req.session.adminId).lean();
        sancion.levantada_por_nombre = admin?.nombre || 'Administrador';
      }
      await sancion.save();
    }

    // 6. Verificar y actualizar estado del usuario
    const usuario = await Usuario.findById(prestamo.usuario_id);
    if (usuario) {
      const tieneBloqueante = await Sancion.exists({
        usuario_id: usuario._id,
        estado: 'Activa',
        tipo_sancion: { $ne: 'Advertencia' },
        $or: [
          { tipo_sancion: 'Suspensión', fecha_fin: { $gt: now } },
          { tipo_sancion: 'Reposición', reposicion_confirmada: { $ne: true } },
          { tipo_sancion: 'Reposición', reposicion_confirmada: true, fecha_fin: { $gt: now } }
        ]
      });

      usuario.estado = tieneBloqueante ? 'Sancionado' : 'Activo';
      usuario.actualizado_en = now;
      await usuario.save();
    }

    flash(req, 'success', 'Reposición confirmada correctamente. El ejemplar se ha habilitado y la sanción se ha actualizado.');
    return res.redirect(`/admin/prestamos/${prestamo._id}`);
  } catch (error) {
    next(error);
  }
};
