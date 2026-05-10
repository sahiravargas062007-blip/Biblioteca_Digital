const cron = require('node-cron');
const Reserva = require('../models/Reserva');
const Usuario = require('../models/Usuario');
const Notificacion = require('../models/Notificacion');
const reservaService = require('../services/reservaService');

module.exports = function verificarReservas() {
  cron.schedule('15 1 * * *', async () => {
    const now = new Date();
    const expiradas = await Reserva.find({
      estado: 'Disponible para reclamar',
      fecha_limite_reclamo: { $lt: now }
    });

    for (const reserva of expiradas) {
      reserva.estado = 'Expirada';
      reserva.fecha_resolucion = now;
      reserva.cancelada_por = 'sistema';
      reserva.motivo_cancelacion = 'La fecha límite de reclamo venció.';
      reserva.actualizado_en = now;
      await reserva.save();

      await Usuario.findByIdAndUpdate(reserva.usuario_id, {
        $inc: { reservas_activas: -1 },
        actualizado_en: now
      }).catch(() => null);

      await Notificacion.create({
        destinatario_tipo: 'usuario',
        destinatario_id: reserva.usuario_id,
        tipo: 'reserva_expirada',
        titulo: 'Reserva expirada',
        mensaje: `Tu reserva del recurso "${reserva.recurso_titulo}" ha expirado.`,
        referencia_tipo: 'reserva',
        referencia_id: reserva._id,
        creado_en: now
      }).catch(() => null);

      const siguiente = await Reserva.findOne({
        recurso_id: reserva.recurso_id,
        tipo: reserva.tipo,
        estado: 'Pendiente'
      }).sort({ posicion: 1 });

      if (siguiente) {
        await reservaService.marcarDisponible(siguiente, null);
      }
    }
  });
};
