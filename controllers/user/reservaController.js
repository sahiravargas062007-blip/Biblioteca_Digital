const Reserva = require('../../models/Reserva');
const Usuario = require('../../models/Usuario');
const Recurso = require('../../models/Recurso');
const Sancion = require('../../models/Sancion');
const Configuracion = require('../../models/Configuracion');
const reservaService = require('../../services/reservaService');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

exports.index = async (req, res, next) => {
  try {
    const reservas = await Reserva.find({ usuario_id: req.session.userId })
      .sort({ fecha_reserva: -1 })
      .lean();

    res.render('user/reservas/index', {
      title: 'Mis reservas',
      reservas
    });
  } catch (error) {
    next(error);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.session.userId);
    if (!usuario || usuario.estado !== 'Activo') {
      flash(req, 'error', 'Su usuario no está activo para realizar reservas.');
      return res.redirect('/catalogo');
    }

    const recurso = await Recurso.findById(req.body.recurso_id).lean();
    if (!recurso) {
      flash(req, 'error', 'El recurso no existe.');
      return res.redirect('/catalogo');
    }

    const recursoDisponible = (recurso.tipo_naturaleza === 'Digital' && recurso.digital?.estado_disponibilidad === 'Disponible') ||
      (['Físico', 'Mixto'].includes(recurso.tipo_naturaleza) && recurso.fisico?.ejemplares_disponibles > 0);

    if (recursoDisponible) {
      flash(req, 'error', 'El recurso está disponible y no requiere reserva.');
      return res.redirect(`/catalogo/${recurso._id}`);
    }

    const recursoReservable = reservaService.esRecursoReservable(recurso);
    if (!recursoReservable) {
      flash(req, 'error', 'Este recurso no se puede reservar en este momento.');
      return res.redirect(`/catalogo/${recurso._id}`);
    }

    const sancionActiva = await Sancion.exists({ usuario_id: usuario._id, estado: 'Activa' });
    if (sancionActiva) {
      flash(req, 'error', 'No puede reservar porque tiene sanciones activas.');
      return res.redirect(`/catalogo/${recurso._id}`);
    }

    const config = await Configuracion.findOne().lean();
    const maxReservas = config?.reservas?.max_reservas_por_usuario || 3;
    if ((usuario.reservas_activas || 0) >= maxReservas) {
      flash(req, 'error', `Ha alcanzado el máximo de ${maxReservas} reservas activas.`);
      return res.redirect(`/catalogo/${recurso._id}`);
    }

    const reservaDuplicada = await Reserva.exists({
      usuario_id: usuario._id,
      recurso_id: recurso._id,
      estado: { $in: ['Pendiente', 'Disponible para reclamar'] }
    });
    if (reservaDuplicada) {
      flash(req, 'error', 'Ya tiene una reserva activa para este recurso.');
      return res.redirect(`/catalogo/${recurso._id}`);
    }

    const tipoReserva = reservaService.obtenerTipoReserva(recurso);

    await reservaService.crearReserva({
      usuario,
      recurso,
      tipo: tipoReserva,
      registradoPor: req.session.userId
    });

    await Usuario.findByIdAndUpdate(usuario._id, {
      $inc: { reservas_activas: 1 },
      actualizado_en: new Date()
    });

    await Recurso.findByIdAndUpdate(recurso._id, {
      $inc: { total_reservas: 1 },
      actualizado_en: new Date()
    });

    flash(req, 'success', 'Reserva registrada correctamente.');
    return res.redirect('/reservas');
  } catch (error) {
    next(error);
  }
};

exports.cancelar = async (req, res, next) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva || String(reserva.usuario_id) !== String(req.session.userId)) {
      flash(req, 'error', 'No se encontró la reserva.');
      return res.redirect('/reservas');
    }

    if (!['Pendiente', 'Disponible para reclamar'].includes(reserva.estado)) {
      flash(req, 'error', 'Solo puede cancelar reservas activas.');
      return res.redirect('/reservas');
    }

    reserva.estado = 'Cancelada';
    reserva.fecha_resolucion = new Date();
    reserva.cancelada_por = 'usuario';
    reserva.motivo_cancelacion = req.body.motivo_cancelacion || 'Cancelada por usuario';
    reserva.actualizado_en = new Date();
    await reserva.save();

    await Usuario.findByIdAndUpdate(reserva.usuario_id, {
      $inc: { reservas_activas: -1 },
      actualizado_en: new Date()
    });

    flash(req, 'success', 'Reserva cancelada correctamente.');
    return res.redirect('/reservas');
  } catch (error) {
    next(error);
  }
};
