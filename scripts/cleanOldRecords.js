// scripts/cleanOldRecords.js
require('dotenv').config();
const connectDB = require('../config/db');
const Prestamo = require('../models/Prestamo');
const Reserva = require('../models/Reserva');
const Usuario = require('../models/Usuario');
const Configuracion = require('../models/Configuracion');

async function cleanOldRecords() {
  await connectDB();
  console.log('Iniciando limpieza manual de registros antiguos...');
  
  const ahora = new Date();
  
  try {
    const config = await Configuracion.findOne().lean();
    const diasConsiderarPerdida = config?.prestamos_fisicos?.dias_considerar_perdida || 30;

    // 1. Limpiar Préstamos Antiguos (Físicos y Digitales)
    const prestamos = await Prestamo.find({
      estado: { $in: ['Activo', 'Parcialmente devuelto', 'Vencido'] },
      'items.estado': { $in: ['Activo', 'Vencido'] },
    });

    let digitalesDevueltos = 0;
    let fisicosVencidos = 0;
    let fisicosPerdidos = 0;

    for (const prestamo of prestamos) {
      let decrementoActivos = false;
      let cambio = false;
      const estadoAnterior = prestamo.estado;

      for (const item of prestamo.items) {
        if (!['Activo', 'Vencido'].includes(item.estado)) continue;
        const limite = new Date(item.fecha_limite);

        if (prestamo.tipo === 'Digital') {
          if (ahora > limite) {
            item.estado = 'Devuelto';
            item.fecha_devolucion_real = ahora;
            item.devolucion = { fecha: ahora, observaciones: 'Limpieza manual: Expiración Digital', estado_ejemplar_al_devolver: 'Bueno' };
            cambio = true;
          }
        } else {
          const limiteVencimiento = new Date(limite.getTime() + (item.dias_tolerancia || 0) * 24 * 60 * 60 * 1000);
          const limitePerdida = new Date(limite.getTime() + diasConsiderarPerdida * 24 * 60 * 60 * 1000);

          if (item.estado === 'Activo' && ahora > limiteVencimiento) {
            item.estado = 'Vencido';
            cambio = true;
          }
          if (item.estado === 'Vencido' && ahora > limitePerdida) {
            item.estado = 'Perdido';
            item.devolucion = { fecha: ahora, observaciones: 'Limpieza manual: Perdido por retraso extremo', estado_ejemplar_al_devolver: 'Perdido' };
            cambio = true;
          }
        }
      }

      if (cambio) {
        const todosDevueltos = prestamo.items.every(i => i.estado === 'Devuelto');
        const todosPerdidosODevueltos = prestamo.items.every(i => ['Perdido', 'Devuelto', 'Devuelto con daño'].includes(i.estado));
        const hayVencidos = prestamo.items.some(i => i.estado === 'Vencido');

        if (todosDevueltos) {
          prestamo.estado = 'Devuelto';
          if (estadoAnterior !== 'Devuelto') decrementoActivos = true;
          digitalesDevueltos++;
        } else if (todosPerdidosODevueltos) {
          prestamo.estado = 'Pendiente de reposición';
          if (!['Pendiente de reposición', 'Devuelto'].includes(estadoAnterior)) decrementoActivos = true;
          fisicosPerdidos++;
        } else if (hayVencidos) {
          prestamo.estado = 'Vencido';
          fisicosVencidos++;
        }

        prestamo.actualizado_en = ahora;
        await prestamo.save();

        if (decrementoActivos) {
          await Usuario.findByIdAndUpdate(prestamo.usuario_id, { $inc: { prestamos_activos: -1 } });
        }
      }
    }

    // 2. Limpiar Reservas Antiguas Atascadas (> 30 días)
    const fechaMuyAntigua = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const reservasAtascadas = await Reserva.find({
      estado: { $in: ['Pendiente', 'Disponible para reclamar'] },
      $or: [
        { fecha_limite_reclamo: { $lt: ahora } },
        { fecha_reserva: { $lt: fechaMuyAntigua } }
      ]
    });

    let reservasCanceladas = 0;
    for (const res of reservasAtascadas) {
      res.estado = 'Expirada';
      res.motivo_cancelacion = 'Limpieza manual: Excedió límite de tiempo o se atascó > 30 días';
      res.cancelada_por = 'sistema';
      await res.save();
      await Usuario.findByIdAndUpdate(res.usuario_id, { $inc: { reservas_activas: -1 } });
      reservasCanceladas++;
    }

    console.log('--- Resumen de Limpieza ---');
    console.log(`Préstamos Digitales Devueltos: ${digitalesDevueltos}`);
    console.log(`Préstamos Físicos Vencidos: ${fisicosVencidos}`);
    console.log(`Préstamos Físicos Perdidos (Pendientes Reposición): ${fisicosPerdidos}`);
    console.log(`Reservas Antiguas/Atascadas Expiradas: ${reservasCanceladas}`);
    console.log('Limpieza completada exitosamente.');
    
  } catch (error) {
    console.error('Error durante la limpieza:', error);
  } finally {
    process.exit(0);
  }
}

cleanOldRecords();

