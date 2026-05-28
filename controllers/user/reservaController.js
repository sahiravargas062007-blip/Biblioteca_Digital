const Reserva = require('../../models/Reserva');
const Usuario = require('../../models/Usuario');
const Recurso = require('../../models/Recurso');
const Sancion = require('../../models/Sancion');
const Configuracion = require('../../models/Configuracion');
const Ejemplar = require('../../models/Ejemplar');
const Prestamo = require('../../models/Prestamo');
const reservaService = require('../../services/reservaService');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

const TIPO_FISICO = 'F\u00edsico';

function tieneNaturalezaFisica(recurso) {
  return [TIPO_FISICO, 'Fisico', 'FÃ­sico', 'Mixto'].includes(recurso.tipo_naturaleza);
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
      flash(req, 'error', 'Su usuario no estÃ¡ activo para realizar reservas.');
      return res.redirect('/catalogo');
    }

    const recurso = await Recurso.findById(req.body.recurso_id).lean();
    if (!recurso) {
      flash(req, 'error', 'El recurso no existe.');
      return res.redirect('/catalogo');
    }

    const tipoSolicitado = req.body.tipo === 'Digital' ? 'Digital' : TIPO_FISICO;
    const tieneFisico = tieneNaturalezaFisica(recurso);
    const tieneDigital = ['Digital', 'Mixto'].includes(recurso.tipo_naturaleza);

    if ((tipoSolicitado === TIPO_FISICO && !tieneFisico) || (tipoSolicitado === 'Digital' && !tieneDigital)) {
      flash(req, 'error', 'Ese tipo de reserva no aplica para este recurso.');
      return res.redirect(`/catalogo/${recurso._id}`);
    }

    const yaTienePrestamo = await Prestamo.exists({
      usuario_id: usuario._id,
      estado: { $in: ['Activo', 'Parcialmente devuelto', 'Vencido'] },
      items: {
        $elemMatch: {
          recurso_id: recurso._id,
          estado: { $in: ['Activo', 'Vencido'] }
        }
      }
    });
    if (yaTienePrestamo) {
      flash(req, 'error', 'Ya tiene un prÃ©stamo activo de este recurso.');
      return res.redirect(`/catalogo/${recurso._id}`);
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
      flash(req, 'error', 'No puede reservar porque tiene sanciones activas.');
      return res.redirect(`/catalogo/${recurso._id}`);
    }

    const config = await Configuracion.findOne().lean();
    const maxReservas = config?.reservas?.max_reservas_por_usuario || 3;
    if ((usuario.reservas_activas || 0) >= maxReservas) {
      flash(req, 'error', `Ha alcanzado el mÃ¡ximo de ${maxReservas} reservas activas.`);
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

    const [ejemplaresDisponiblesRaw, solicitudesEnReclamo] = tipoSolicitado === TIPO_FISICO
      ? await Promise.all([
          Ejemplar.countDocuments({ recurso_id: recurso._id, estado: 'Disponible' }),
          Reserva.countDocuments({
            recurso_id: recurso._id,
            tipo: TIPO_FISICO,
            estado: 'Disponible para reclamar'
          })
        ])
      : [0, 0];
    const ejemplaresDisponibles = Math.max(0, ejemplaresDisponiblesRaw - solicitudesEnReclamo);

    recurso.fisico = {
      ...(recurso.fisico || {}),
      ejemplares_disponibles: ejemplaresDisponibles
    };

    const licenciasEnUso = tipoSolicitado === 'Digital'
      ? await Prestamo.countDocuments({
          tipo: 'Digital',
          estado: { $in: ['Activo', 'Parcialmente devuelto', 'Vencido'] },
          items: {
            $elemMatch: {
              recurso_id: recurso._id,
              estado: { $in: ['Activo', 'Vencido'] }
            }
          }
        })
      : (recurso.digital?.licencias_en_uso || 0);
    const maxLicencias = recurso.digital?.licencia?.usuarios_simultaneos || 1;
    const digitalDisponible = recurso.digital?.estado_disponibilidad === 'Disponible'
      && licenciasEnUso < maxLicencias;

    if (tipoSolicitado === 'Digital' && digitalDisponible) {
      flash(req, 'error', 'El recurso digital tiene licencias disponibles; puede prestarlo directamente.');
      return res.redirect(`/catalogo/${recurso._id}`);
    }

    const recursoReservable = tipoSolicitado === TIPO_FISICO
      ? true
      : reservaService.esRecursoReservable(recurso);
    if (!recursoReservable) {
      flash(req, 'error', 'Este recurso no se puede reservar en este momento.');
      return res.redirect(`/catalogo/${recurso._id}`);
    }

    const disponibleParaReclamar = tipoSolicitado === TIPO_FISICO && ejemplaresDisponibles > 0;
    const limiteReclamo = disponibleParaReclamar
      ? await reservaService.calcularLimiteReclamo(now)
      : undefined;

    const reserva = await reservaService.crearReserva({
      usuario,
      recurso,
      tipo: tipoSolicitado,
      registradoPor: req.session.userId,
      estadoInicial: disponibleParaReclamar ? 'Disponible para reclamar' : 'Pendiente',
      fechaDisponible: disponibleParaReclamar ? now : undefined,
      fechaLimiteReclamo: limiteReclamo
    });

    await Usuario.findByIdAndUpdate(usuario._id, {
      $inc: { reservas_activas: 1 },
      actualizado_en: new Date()
    });

    await Recurso.findByIdAndUpdate(recurso._id, {
      $inc: { total_reservas: 1 },
      actualizado_en: new Date()
    });

    const mensaje = disponibleParaReclamar
      ? `Solicitud fÃ­sica registrada. Tiene plazo para reclamar hasta ${limiteReclamo.toLocaleString('es-CO')}.`
      : `Reserva registrada correctamente. EstÃ¡ en la posiciÃ³n ${reserva.posicion} de la fila.`;
    flash(req, 'success', mensaje);
    return res.redirect('/reservas');
  } catch (error) {
    next(error);
  }
};

exports.cancelar = async (req, res, next) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva || String(reserva.usuario_id) !== String(req.session.userId)) {
      flash(req, 'error', 'No se encontrÃ³ la reserva.');
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
