/**
 * jobs/verificarVencimientos.js
 * Se ejecuta todos los días a la 01:00.
 * Marca como vencidos los préstamos que superaron su fecha límite
 * y notifica a los usuarios afectados.
 */

const cron = require('node-cron');
const Prestamo = require('../models/Prestamo');
const Usuario = require('../models/Usuario');
const JobLog = require('../models/JobLog');
const notifService = require('../services/notificacionService');

module.exports = function verificarVencimientos() {
  cron.schedule('0 1 * * *', async () => {
    const inicio = Date.now();
    const ahora = new Date();
    let actualizados = 0;
    let errores = [];

    try {
      const prestamos = await Prestamo.find({
        estado: { $in: ['Activo', 'Parcialmente devuelto'] },
        'items.estado': 'Activo',
        'items.fecha_limite': { $lt: ahora }
      });

      for (const prestamo of prestamos) {
        let cambio = false;

        for (const item of prestamo.items) {
          if (item.estado !== 'Activo') continue;
          const limite = new Date(item.fecha_limite);
          const diasTolerancia = item.dias_tolerancia || 0;
          const limiteFinal = new Date(limite.getTime() + diasTolerancia * 24 * 60 * 60 * 1000);

          if (ahora > limiteFinal) {
            item.estado = 'Vencido';
            cambio = true;

            // Notificar al usuario
            try {
              const usuario = await Usuario.findById(prestamo.usuario_id).lean();
              if (usuario) {
                await notifService.recursoVencido(usuario, prestamo, item);
              }
            } catch (err) {
              errores.push(`Item ${item._id}: ${err.message}`);
            }
          }
        }

        if (cambio) {
          // Recalcular estado general del préstamo
          const todosVencidos = prestamo.items.every(i => i.estado === 'Vencido');
          const hayActivos = prestamo.items.some(i => i.estado === 'Activo');
          prestamo.estado = todosVencidos ? 'Vencido' : hayActivos ? 'Parcialmente devuelto' : prestamo.estado;
          prestamo.actualizado_en = ahora;
          await prestamo.save();
          actualizados++;
        }
      }

      await JobLog.create({
        job: 'verificarVencimientos',
        ejecutado_en: ahora,
        duracion_ms: Date.now() - inicio,
        resultado: { prestamos_actualizados: actualizados, errores },
        estado: errores.length ? 'fallido' : 'exitoso'
      }).catch(() => null);

    } catch (err) {
      console.error('[verificarVencimientos] Error:', err.message);
    }
  });
};
