/**
 * jobs/enviarRecordatorios.js
 * Se ejecuta todos los días a las 07:30.
 * CA1: notifica a usuarios con préstamos que vencen en las próximas 24 horas.
 */

const cron = require('node-cron');
const Prestamo = require('../models/Prestamo');
const Usuario = require('../models/Usuario');
const Notificacion = require('../models/Notificacion');
const JobLog = require('../models/JobLog');
const notifService = require('../services/notificacionService');

module.exports = function enviarRecordatorios() {
  // Todos los días a las 07:30
  cron.schedule('30 7 * * *', async () => {
    const inicio = Date.now();
    const ahora = new Date();
    const en24h = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
    let correos = 0;
    let errores = [];

    try {
      // Buscar ítems activos que vencen en las próximas 24 horas
      const prestamos = await Prestamo.find({
        estado: { $in: ['Activo', 'Parcialmente devuelto'] },
        'items.estado': 'Activo',
        'items.fecha_limite': { $gte: ahora, $lte: en24h }
      }).lean();

      for (const prestamo of prestamos) {
        const itemsProximos = prestamo.items.filter(i =>
          i.estado === 'Activo' &&
          new Date(i.fecha_limite) >= ahora &&
          new Date(i.fecha_limite) <= en24h
        );

        if (!itemsProximos.length) continue;

        // Verificar que no se haya enviado ya hoy para este préstamo
        const yaNotificado = await Notificacion.exists({
          destinatario_id: prestamo.usuario_id,
          tipo: 'proximo_vencimiento',
          referencia_id: prestamo._id,
          creado_en: { $gte: new Date(ahora.toDateString()) }
        });
        if (yaNotificado) continue;

        const usuario = await Usuario.findById(prestamo.usuario_id).lean();
        if (!usuario) continue;

        for (const item of itemsProximos) {
          try {
            await notifService.proximoVencimiento(usuario, prestamo, item);
            correos++;
          } catch (err) {
            errores.push(`Préstamo ${prestamo._id}: ${err.message}`);
          }
        }
      }

      await JobLog.create({
        job: 'enviarRecordatorios',
        ejecutado_en: ahora,
        duracion_ms: Date.now() - inicio,
        resultado: { correos_enviados: correos, errores },
        estado: errores.length ? 'fallido' : 'exitoso'
      }).catch(() => null);

    } catch (err) {
      console.error('[enviarRecordatorios] Error:', err.message);
    }
  });
};
