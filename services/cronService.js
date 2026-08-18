const cron = require('node-cron');
const mongoose = require('mongoose');
const Reserva = require('../models/Reserva');
const Prestamo = require('../models/Prestamo');
const Usuario = require('../models/Usuario');
const Configuracion = require('../models/Configuracion');

/**
 * Ejecuta el barrido de base de datos para limpiar registros caducados
 */
async function ejecutarLimpieza() {
  console.log('[Cron] Iniciando rutina de limpieza de reservas y préstamos...');
  const now = new Date();
  
  try {
    const config = await Configuracion.findOne().lean();
    if (!config) return { success: false, message: 'No hay configuración' };

    let stats = {
      reservasExpiradas: 0,
      digitalesDevueltos: 0,
      fisicosVencidos: 0,
      fisicosPerdidos: 0
    };

    // 1. Expirar Reservas
    const horasReclamo = config.reservas?.tiempo_max_reclamo_horas || 24;
    const tiempoLimite = new Date(now.getTime() - horasReclamo * 60 * 60 * 1000);
    
    const reservasExpiradas = await Reserva.find({
      estado: { $in: ['Pendiente', 'Disponible para reclamar'] },
      $or: [
        { fecha_limite_reclamo: { $lt: now } },
        { fecha_limite_reclamo: { $exists: false }, fecha_reserva: { $lt: tiempoLimite } }
      ]
    });

    for (const res of reservasExpiradas) {
      res.estado = 'Expirada';
      res.motivo_cancelacion = 'Expiración automática por tiempo límite de reclamo';
      res.cancelada_por = 'sistema';
      await res.save();
      
      // Restar contador al usuario
      await Usuario.findByIdAndUpdate(res.usuario_id, { $inc: { reservas_activas: -1 } });
      stats.reservasExpiradas++;
      console.log(`[Cron] Reserva ${res._id} expirada automáticamente.`);
    }

    // 2. Préstamos Digitales Vencidos -> Devolución Automática
    const prestamosDigitalesVencidos = await Prestamo.find({
      tipo: 'Digital',
      estado: { $in: ['Activo', 'Parcialmente devuelto'] },
      'items.estado': 'Activo',
      'items.fecha_limite': { $lt: now }
    });

    for (const p of prestamosDigitalesVencidos) {
      let devueltos = 0;
      for (const item of p.items) {
        if (item.estado === 'Activo' && new Date(item.fecha_limite) < now) {
          item.estado = 'Devuelto';
          item.fecha_devolucion_real = now;
          item.devolucion = {
            fecha: now,
            observaciones: 'Devolución automática por expiración de tiempo (Digital)',
            estado_ejemplar_al_devolver: 'Bueno'
          };
          devueltos++;
        }
      }
      if (devueltos > 0) {
        const todosDevueltos = p.items.every(i => i.estado === 'Devuelto');
        p.estado = todosDevueltos ? 'Devuelto' : 'Parcialmente devuelto';
        p.actualizado_en = now;
        await p.save();
        
        if (todosDevueltos) {
          await Usuario.findByIdAndUpdate(p.usuario_id, { $inc: { prestamos_activos: -1 } });
        }
        stats.digitalesDevueltos++;
        console.log(`[Cron] Préstamo Digital ${p._id}: ${devueltos} ítems devueltos automáticamente.`);
      }
    }

    // 3. Préstamos Físicos -> Marcar Vencidos
    const prestamosFisicos = await Prestamo.find({
      tipo: 'Físico',
      estado: { $in: ['Activo', 'Parcialmente devuelto'] },
      'items.estado': 'Activo',
      'items.fecha_limite': { $lt: now }
    });

    for (const p of prestamosFisicos) {
      let cambiados = 0;
      for (const item of p.items) {
        if (item.estado === 'Activo' && new Date(item.fecha_limite) < now) {
          item.estado = 'Vencido';
          cambiados++;
        }
      }
      if (cambiados > 0) {
        p.estado = 'Vencido';
        p.actualizado_en = now;
        await p.save();
        stats.fisicosVencidos++;
        console.log(`[Cron] Préstamo Físico ${p._id} marcado como Vencido.`);
      }
    }

    // 4. Préstamos Físicos Vencidos -> Marcar Pérdida si excede límite configurado
    const diasConsiderarPerdida = config.prestamos_fisicos?.dias_considerar_perdida || 30;
    const fechaPérdida = new Date(now.getTime() - diasConsiderarPerdida * 24 * 60 * 60 * 1000);
    
    const prestamosParaPerdida = await Prestamo.find({
      tipo: 'Físico',
      estado: 'Vencido',
      'items.estado': 'Vencido',
      'items.fecha_limite': { $lt: fechaPérdida }
    });

    for (const p of prestamosParaPerdida) {
      let perdidos = 0;
      for (const item of p.items) {
        if (item.estado === 'Vencido' && new Date(item.fecha_limite) < fechaPérdida) {
          item.estado = 'Perdido';
          item.devolucion = {
            fecha: now,
            observaciones: `Marcado como perdido automáticamente por exceder ${diasConsiderarPerdida} días desde su vencimiento.`,
            estado_ejemplar_al_devolver: 'Perdido'
          };
          perdidos++;
        }
      }
      if (perdidos > 0) {
        const todosPerdidosODevueltos = p.items.every(i => ['Perdido', 'Devuelto', 'Devuelto con daño'].includes(i.estado));
        p.estado = todosPerdidosODevueltos ? 'Pendiente de reposición' : 'Vencido';
        p.actualizado_en = now;
        await p.save();
        
        if (todosPerdidosODevueltos) {
          // El usuario ya no lo tiene, debe reponerlo
          await Usuario.findByIdAndUpdate(p.usuario_id, { $inc: { prestamos_activos: -1 } });
        }
        stats.fisicosPerdidos++;
        console.log(`[Cron] Préstamo Físico ${p._id} marcado como Perdido/Pendiente de reposición.`);
      }
    }

    console.log('[Cron] Rutina de limpieza completada:', stats);
    return { success: true, stats };
  } catch (error) {
    console.error('[Cron] Error en rutina de limpieza:', error);
    return { success: false, error: error.message };
  }
}

// Iniciar cron schedule si este módulo se carga
function initCron() {
  // Se ejecuta todos los días a las 00:00 (medianoche)
  cron.schedule('0 0 * * *', () => {
    ejecutarLimpieza();
  });
  console.log('[Cron] Servicio programado (00:00 diario).');
}

module.exports = {
  ejecutarLimpieza,
  initCron
};
