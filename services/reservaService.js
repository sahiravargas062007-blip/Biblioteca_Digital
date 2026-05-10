const Configuracion = require('../models/Configuracion');
const Notificacion = require('../models/Notificacion');
const Reserva = require('../models/Reserva');

exports.siguientePosicion = async (recursoId, tipo) => {
  const count = await Reserva.countDocuments({
    recurso_id: recursoId,
    tipo,
    estado: { $in: ['Pendiente', 'Disponible para reclamar'] }
  });
  return count + 1;
};

exports.crearReserva = async ({ usuario, recurso, tipo = 'Físico', registradoPor }) => {
  const posicion = await exports.siguientePosicion(recurso._id, tipo);
  return Reserva.create({
    usuario_id: usuario._id,
    usuario_nombre: usuario.nombre,
    usuario_documento: usuario.documento,
    recurso_id: recurso._id,
    recurso_titulo: recurso.titulo,
    recurso_imagen: recurso.imagen?.url,
    tipo,
    posicion,
    estado: 'Pendiente',
    fecha_reserva: new Date(),
    registrado_por: registradoPor,
    creado_en: new Date(),
    actualizado_en: new Date()
  });
};

exports.marcarDisponible = async (reserva, adminId) => {
  const config = await Configuracion.findOne().lean();
  const horas = config?.reservas?.tiempo_max_reclamo_horas || 24;
  const now = new Date();
  const limite = new Date(now.getTime() + horas * 60 * 60 * 1000);

  reserva.estado = 'Disponible para reclamar';
  reserva.fecha_disponible = now;
  reserva.fecha_limite_reclamo = limite;
  reserva.actualizado_en = now;
  await reserva.save();

  await Notificacion.create({
    destinatario_tipo: 'usuario',
    destinatario_id: reserva.usuario_id,
    tipo: 'turno_reserva_disponible',
    titulo: 'Turno de reserva disponible',
    mensaje: `El recurso "${reserva.recurso_titulo}" está disponible para reclamar hasta ${limite.toLocaleString('es-CO')}.`,
    referencia_tipo: 'reserva',
    referencia_id: reserva._id,
    creado_en: now
  }).catch(() => null);

  return reserva;
};

exports.esRecursoReservable = (recurso) => {
  const fisicoDisponible = recurso.fisico?.ejemplares_disponibles > 0;
  const digitalDisponible = recurso.digital?.estado_disponibilidad === 'Disponible';
  const colaDigital = recurso.digital?.licencia?.cola_reservas_habilitada === true;

  if (recurso.tipo_naturaleza === 'Físico') {
    return recurso.fisico?.ejemplares_disponibles === 0;
  }

  if (recurso.tipo_naturaleza === 'Digital') {
    return colaDigital && !digitalDisponible;
  }

  if (recurso.tipo_naturaleza === 'Mixto') {
    if (!fisicoDisponible) return true;
    return !digitalDisponible && colaDigital;
  }

  return false;
};

exports.obtenerTipoReserva = (recurso) => {
  if (recurso.tipo_naturaleza === 'Digital') return 'Digital';
  if (recurso.tipo_naturaleza === 'Mixto') {
    if (recurso.fisico?.ejemplares_disponibles === 0) return 'Físico';
    return 'Digital';
  }
  return 'Físico';
};
