const Ejemplar = require('../../models/Ejemplar');
const Prestamo = require('../../models/Prestamo');
const Recurso = require('../../models/Recurso');
const Usuario = require('../../models/Usuario');
const sancionController = require('./sancionController');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

function estadoGeneral(items) {
  if (items.every((item) => ['Devuelto', 'Devuelto con daño'].includes(item.estado))) return 'Devuelto';
  if (items.some((item) => item.estado === 'Vencido')) return 'Vencido';
  if (items.some((item) => ['Devuelto', 'Devuelto con daño'].includes(item.estado))) return 'Parcialmente devuelto';
  return 'Activo';
}

exports.crear = async (req, res, next) => {
  try {
    const prestamo = await Prestamo.findById(req.body.prestamo_id);
    const item = prestamo?.items.id(req.body.item_id);

    if (!prestamo || !item) {
      flash(req, 'error', 'Ítem de préstamo no encontrado.');
      return res.redirect('/admin/prestamos');
    }

    if (!['Activo', 'Vencido'].includes(item.estado)) {
      flash(req, 'error', 'El ítem ya fue devuelto o cerrado.');
      return res.redirect(`/admin/prestamos/${prestamo._id}`);
    }

    const estadoDevolucion = req.body.estado_ejemplar_al_devolver || 'Bueno';
    const now = new Date();
    const ejemplar = await Ejemplar.findById(item.ejemplar_id);
    const nuevoEstadoEjemplar = estadoDevolucion === 'Dañado' ? 'Dañado' : estadoDevolucion === 'Perdido' ? 'Perdido' : 'Disponible';

    item.fecha_devolucion_real = now;
    item.estado = estadoDevolucion === 'Dañado' ? 'Devuelto con daño' : estadoDevolucion === 'Perdido' ? 'Perdido' : 'Devuelto';
    item.devolucion = {
      fecha: now,
      observaciones: req.body.observaciones || '',
      estado_ejemplar_al_devolver: estadoDevolucion,
      registrado_por: req.session.adminId
    };

    prestamo.estado = estadoDevolucion === 'Perdido' ? 'Pendiente de reposición' : estadoGeneral(prestamo.items);
    prestamo.actualizado_en = now;
    await prestamo.save();

    if (ejemplar) {
      ejemplar.historial_estados.push({
        estado_anterior: ejemplar.estado,
        estado_nuevo: nuevoEstadoEjemplar,
        cambiado_por: req.session.adminId,
        cambiado_en: now,
        observacion: req.body.observaciones || 'Devolución registrada'
      });
      ejemplar.estado = nuevoEstadoEjemplar;
      ejemplar.descripcion_dano = estadoDevolucion === 'Dañado' ? req.body.observaciones : ejemplar.descripcion_dano;
      ejemplar.actualizado_en = now;
      await ejemplar.save();
    }

    const incDisponible = nuevoEstadoEjemplar === 'Disponible' ? 1 : 0;
    await Promise.all([
      Usuario.findByIdAndUpdate(prestamo.usuario_id, { $inc: { prestamos_activos: -1 }, actualizado_en: now }),
      Recurso.findByIdAndUpdate(item.recurso_id, {
        $inc: { 'fisico.ejemplares_disponibles': incDisponible },
        actualizado_en: now
      })
    ]);

    if (estadoDevolucion === 'Perdido') {
      const sugerida = await sancionController._sugerirSancion('Pérdida', 'Grave');
      await sancionController._crearSancionDesdePayload(req, {
        usuario_id: prestamo.usuario_id,
        prestamo_id: prestamo._id,
        item_prestamo_id: item._id,
        recurso_titulo: item.recurso_titulo,
        ejemplar_codigo: item.codigo_inventario,
        tipo_incidencia: 'Pérdida',
        gravedad: 'Grave',
        tipo_sancion: sugerida.tipo_sancion || 'Reposición',
        dias_suspension: sugerida.dias_suspension || 0,
        observaciones: req.body.observaciones || 'Ejemplar reportado como perdido en devolución.',
        incluye_multa: sugerida.incluye_multa
      });
    }

    flash(req, 'success', 'Devolución registrada correctamente.');
    return res.redirect(`/admin/prestamos/${prestamo._id}`);
  } catch (error) {
    next(error);
  }
};
