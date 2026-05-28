const notifService = require('../../services/notificacionService');

const Ejemplar = require('../../models/Ejemplar');
const Prestamo = require('../../models/Prestamo');
const Recurso = require('../../models/Recurso');
const Reserva = require('../../models/Reserva');
const Usuario = require('../../models/Usuario');
const Configuracion = require('../../models/Configuracion');
const sancionController = require('./sancionController');
const reservaService = require('../../services/reservaService');

const TIPO_FISICO = 'F\u00edsico';

function flash(req, type, message) {
  req.session.flash = { type, message };
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + Number(days || 0));
  return result;
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

    if (incDisponible > 0) {
      const siguiente = await Reserva.findOne({
        recurso_id: item.recurso_id,
        tipo: TIPO_FISICO,
        estado: 'Pendiente'
      }).sort({ posicion: 1 });
      if (siguiente) await reservaService.marcarDisponible(siguiente, req.session.adminId);
    }

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
        incluye_multa: false,
        valor_multa: 0
      });
    }

    // ── Detección de retraso
    const config = await Configuracion.findOne().lean();
    const limiteConTolerancia = addDays(item.fecha_limite, item.dias_tolerancia || 0);
    const esRetraso = now > limiteConTolerancia;

    if (esRetraso) {
      const msDiff = now.getTime() - item.fecha_limite.getTime();
      const diasRetraso = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

      if (diasRetraso > 0) {
        // Determinar gravedad según rangos
        const leveMax = config?.sanciones?.retraso_leve_max_dias || 3;
        const modMax = config?.sanciones?.retraso_moderada_max_dias || 7;

        let gravedad = 'Leve';
        if (diasRetraso <= leveMax) {
          gravedad = 'Leve';
        } else if (diasRetraso <= modMax) {
          gravedad = 'Moderada';
        } else {
          gravedad = 'Grave';
        }

        // Buscar regla sugerida
        const sugerida = await sancionController._sugerirSancion('Retraso', gravedad);

        await sancionController._crearSancionDesdePayload(req, {
          usuario_id: prestamo.usuario_id,
          prestamo_id: prestamo._id,
          item_prestamo_id: item._id,
          recurso_titulo: item.recurso_titulo,
          ejemplar_codigo: item.codigo_inventario,
          tipo_incidencia: 'Retraso',
          gravedad: gravedad,
          tipo_sancion: sugerida.tipo_sancion || 'Advertencia',
          dias_suspension: sugerida.dias_suspension || 0,
          observaciones: req.body.observaciones || `Devolución retrasada por ${diasRetraso} día(s).`,
          incluye_multa: false,
          valor_multa: 0
        });
      }
    }

    if (estadoDevolucion === 'Dañado') {
      const sugerida = await sancionController._sugerirSancion('Daño', 'Moderada');
      await sancionController._crearSancionDesdePayload(req, {
        usuario_id: prestamo.usuario_id,
        prestamo_id: prestamo._id,
        item_prestamo_id: item._id,
        recurso_titulo: item.recurso_titulo,
        ejemplar_codigo: item.codigo_inventario,
        tipo_incidencia: 'Daño',
        gravedad: 'Moderada',
        tipo_sancion: sugerida.tipo_sancion || 'Suspensión',
        dias_suspension: sugerida.dias_suspension || 0,
        observaciones: req.body.observaciones || 'Ejemplar reportado como dañado en devolución.',
        incluye_multa: false,
        valor_multa: 0
      });
    }

    // Notificar al usuario (devolución confirmada)
    try {
      const Usuario = require('../../models/Usuario');
      const usuarioDoc = await Usuario.findById(prestamo.usuario_id).lean();
      if (usuarioDoc && item) {
        await notifService.devolucionConfirmada(usuarioDoc, prestamo, item);
      }
    } catch (_e) { }
    flash(req, 'success', 'Devolución registrada correctamente.');
    return res.redirect(`/admin/prestamos/${prestamo._id}`);
  } catch (error) {
    next(error);
  }
};
