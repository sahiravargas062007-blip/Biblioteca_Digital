const Configuracion = require('../models/Configuracion');
const Notificacion = require('../models/Notificacion');
const Reserva = require('../models/Reserva');
const Usuario = require('../models/Usuario');
const notifService = require('./notificacionService');

const TIPO_FISICO = 'F\u00edsico';

exports.siguientePosicion = async (recursoId, tipo) => {
  const count = await Reserva.countDocuments({
    recurso_id: recursoId,
    tipo,
    estado: { $in: ['Pendiente', 'Disponible para reclamar'] }
  });
  return count + 1;
};

function sumarHorasHabiles(fecha, horas) {
  const resultado = new Date(fecha);
  let restantes = Math.max(0, Number(horas || 0));

  while (restantes > 0) {
    resultado.setHours(resultado.getHours() + 1);
    const dia = resultado.getDay();
    if (dia !== 0 && dia !== 6) restantes -= 1;
  }

  return resultado;
}

exports.calcularLimiteReclamo = async (fechaBase = new Date()) => {
  const config = await Configuracion.findOne().lean();
  const horas = config?.reservas?.tiempo_max_reclamo_horas || 24;
  return sumarHorasHabiles(fechaBase, horas);
};

exports.crearReserva = async ({
  usuario,
  recurso,
  tipo = TIPO_FISICO,
  registradoPor,
  estadoInicial = 'Pendiente',
  fechaDisponible,
  fechaLimiteReclamo
}) => {
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
    estado: estadoInicial,
    fecha_reserva: new Date(),
    fecha_disponible: fechaDisponible,
    fecha_limite_reclamo: fechaLimiteReclamo,
    registrado_por: registradoPor,
    creado_en: new Date(),
    actualizado_en: new Date()
  });
};

exports.marcarDisponible = async (reserva, adminId) => {
  const now = new Date();
  const limite = await exports.calcularLimiteReclamo(now);

  reserva.estado = 'Disponible para reclamar';
  reserva.fecha_disponible = now;
  reserva.fecha_limite_reclamo = limite;
  reserva.actualizado_en = now;
  await reserva.save();

  try {
    const usuario = await Usuario.findById(reserva.usuario_id);
    if (usuario) {
      const config = await Configuracion.findOne().lean();
      const horas = config?.reservas?.tiempo_max_reclamo_horas || 24;
      await notifService.turnoReservaDisponible(usuario, reserva, horas);
    }
  } catch (_e) { }

  return reserva;
};

exports.esRecursoReservable = (recurso) => {
  const fisicoDisponible = recurso.fisico?.ejemplares_disponibles > 0;
  const digitalDisponible = recurso.digital?.estado_disponibilidad === 'Disponible';
  const colaDigital = recurso.digital?.licencia?.cola_reservas_habilitada === true;

  if ([TIPO_FISICO, 'Fisico', 'FÃ­sico'].includes(recurso.tipo_naturaleza)) {
    return true;
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
    if (recurso.fisico?.ejemplares_disponibles === 0) return TIPO_FISICO;
    return 'Digital';
  }
  return TIPO_FISICO;
};
