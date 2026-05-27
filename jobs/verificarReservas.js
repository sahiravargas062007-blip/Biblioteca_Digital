/**
 * jobs/verificarReservas.js
 * Se ejecuta todos los días a la 01:15.
 * Expira reservas vencidas, avanza la cola y notifica.
 * RN4: si no hay siguiente usuario, notifica al administrador.
 */

const cron = require('node-cron');
const Reserva = require('../models/Reserva');
const Usuario = require('../models/Usuario');
const Administrador = require('../models/Administrador');
const Recurso = require('../models/Recurso');
const JobLog = require('../models/JobLog');
const reservaService = require('../services/reservaService');
const notifService = require('../services/notificacionService');

module.exports = function verificarReservas() {
  cron.schedule('15 1 * * *', async () => {
    const inicio = Date.now();
    const ahora = new Date();
    let expiradas = 0;
    let errores = [];

    try {
      const reservasVencidas = await Reserva.find({
        estado: 'Disponible para reclamar',
        fecha_limite_reclamo: { $lt: ahora }
      });

      for (const reserva of reservasVencidas) {
        try {
          // Expirar la reserva
          reserva.estado = 'Expirada';
          reserva.fecha_resolucion = ahora;
          reserva.cancelada_por = 'sistema';
          reserva.motivo_cancelacion = 'La fecha límite de reclamo venció.';
          reserva.actualizado_en = ahora;
          await reserva.save();

          await Usuario.findByIdAndUpdate(reserva.usuario_id, {
            $inc: { reservas_activas: -1 },
            actualizado_en: ahora
          }).catch(() => null);

          // Notificar al usuario que su reserva expiró
          const usuario = await Usuario.findById(reserva.usuario_id).lean();
          if (usuario) {
            await notifService.reservaExpirada(usuario, reserva);
          }

          expiradas++;

          // Avanzar la cola
          const siguiente = await Reserva.findOne({
            recurso_id: reserva.recurso_id,
            tipo: reserva.tipo,
            estado: 'Pendiente'
          }).sort({ posicion: 1 });

          if (siguiente) {
            // Obtener config de tiempo de espera
            const Configuracion = require('../models/Configuracion');
            const config = await Configuracion.findOne().lean();
            const horas = config?.reservas?.tiempo_max_reclamo_horas || 24;

            await reservaService.marcarDisponible(siguiente, null);

            // Notificar al siguiente en la cola
            const siguienteUsuario = await Usuario.findById(siguiente.usuario_id).lean();
            if (siguienteUsuario) {
              await notifService.turnoReservaDisponible(siguienteUsuario, siguiente, horas);
            }
          } else {
            // Sin siguiente usuario — notificar al administrador (RN4)
            const admin = await Administrador.findOne({ activo: true }).sort({ creado_en: 1 }).lean();
            if (admin) {
              await notifService.reservaSinSiguienteUsuario(admin._id, reserva);
            }
          }

        } catch (err) {
          errores.push(`Reserva ${reserva._id}: ${err.message}`);
        }
      }

      await JobLog.create({
        job: 'verificarReservas',
        ejecutado_en: ahora,
        duracion_ms: Date.now() - inicio,
        resultado: { reservas_expiradas: expiradas, errores },
        estado: errores.length ? 'fallido' : 'exitoso'
      }).catch(() => null);

    } catch (err) {
      console.error('[verificarReservas] Error:', err.message);
    }
  });
};
