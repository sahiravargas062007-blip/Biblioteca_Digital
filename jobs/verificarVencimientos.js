/**
 * jobs/verificarVencimientos.js
 * Se ejecuta todos los días a la 01:00.
 * Marca como vencidos los préstamos que superaron su fecha límite,
 * devuelve automáticamente los digitales, y marca como perdidos los físicos con mucho retraso.
 */

const cron = require('node-cron');
const Prestamo = require('../models/Prestamo');
const Usuario = require('../models/Usuario');
const JobLog = require('../models/JobLog');
const Configuracion = require('../models/Configuracion');
const notifService = require('../services/notificacionService');

module.exports = function verificarVencimientos() {
  cron.schedule('0 1 * * *', async () => {
    const inicio = Date.now();
    const ahora = new Date();
    let actualizados = 0;
    let errores = [];

    try {
      const config = await Configuracion.findOne().lean();
      const diasConsiderarPerdida = config?.prestamos_fisicos?.dias_considerar_perdida || 30;

      const prestamos = await Prestamo.find({
        estado: { $in: ['Activo', 'Parcialmente devuelto', 'Vencido'] },
        'items.estado': { $in: ['Activo', 'Vencido'] },
      });

      for (const prestamo of prestamos) {
        let cambio = false;
        let decrementoActivos = false;

        for (const item of prestamo.items) {
          if (!['Activo', 'Vencido'].includes(item.estado)) continue;
          
          const limite = new Date(item.fecha_limite);

          // 1. Lógica para Préstamos Digitales (Devolución Automática)
          if (prestamo.tipo === 'Digital') {
            if (ahora > limite) {
              item.estado = 'Devuelto';
              item.fecha_devolucion_real = ahora;
              item.devolucion = {
                fecha: ahora,
                observaciones: 'Devolución automática por expiración de tiempo (Digital)',
                estado_ejemplar_al_devolver: 'Bueno'
              };
              cambio = true;
            }
          } 
          // 2. Lógica para Préstamos Físicos (Vencimiento y Pérdida)
          else {
            const diasTolerancia = item.dias_tolerancia || 0;
            const limiteVencimiento = new Date(limite.getTime() + diasTolerancia * 24 * 60 * 60 * 1000);
            const limitePerdida = new Date(limite.getTime() + diasConsiderarPerdida * 24 * 60 * 60 * 1000);

            if (item.estado === 'Activo' && ahora > limiteVencimiento) {
              item.estado = 'Vencido';
              cambio = true;
              try {
                const usuario = await Usuario.findById(prestamo.usuario_id).lean();
                if (usuario) await notifService.recursoVencido(usuario, prestamo, item);
              } catch (err) {
                errores.push(`Item Vencido ${item._id}: ${err.message}`);
              }
            }

            if (item.estado === 'Vencido' && ahora > limitePerdida) {
              item.estado = 'Perdido';
              item.devolucion = {
                fecha: ahora,
                observaciones: `Marcado como perdido automáticamente por exceder ${diasConsiderarPerdida} días de retraso.`,
                estado_ejemplar_al_devolver: 'Perdido'
              };
              cambio = true;
            }
          }
        }

        if (cambio) {
          const todosDevueltos = prestamo.items.every(i => i.estado === 'Devuelto');
          const todosPerdidosODevueltos = prestamo.items.every(i => ['Perdido', 'Devuelto', 'Devuelto con daño'].includes(i.estado));
          const hayActivos = prestamo.items.some(i => i.estado === 'Activo');
          const hayVencidos = prestamo.items.some(i => i.estado === 'Vencido');

          // Cuidado: Si un préstamo está Vencido, al volverse 'Pendiente de reposición' debemos liberar al usuario
          // Si estaba Activo y se vuelve Vencido, NO liberamos al usuario
          const estadoAnterior = prestamo.estado;

          if (todosDevueltos) {
            prestamo.estado = 'Devuelto';
            if (estadoAnterior !== 'Devuelto') decrementoActivos = true;
          } else if (todosPerdidosODevueltos) {
            prestamo.estado = 'Pendiente de reposición';
            if (!['Pendiente de reposición', 'Devuelto'].includes(estadoAnterior)) decrementoActivos = true;
          } else if (hayVencidos) {
            prestamo.estado = 'Vencido';
          } else if (hayActivos) {
            prestamo.estado = 'Parcialmente devuelto';
          }

          prestamo.actualizado_en = ahora;
          await prestamo.save();

          if (decrementoActivos) {
            await Usuario.findByIdAndUpdate(prestamo.usuario_id, { $inc: { prestamos_activos: -1 } });
          }

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
