const mongoose = require('mongoose');

const notificacionSchema = new mongoose.Schema({
  destinatario_tipo: {
    type: String,
    enum: ['usuario', 'administrador'],
    required: true
  },
  destinatario_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  tipo: {
    type: String,
    enum: [
      'prestamo_aprobado',
      'proximo_vencimiento',
      'recurso_vencido',
      'sancion_registrada',
      'devolucion_confirmada',
      'renovacion_confirmada',
      'turno_reserva_disponible',
      'reserva_expirada',
      'nuevo_usuario_pendiente',
      'recursos_proximos_vencer',
      'reserva_sin_siguiente_usuario'
      , 'acceso_aprobado'
    ],
    required: true
  },
  titulo: { type: String, required: true },
  mensaje: { type: String, required: true },
  referencia_tipo: {
    type: String,
    enum: ['prestamo', 'reserva', 'sancion', 'usuario', null],
    default: null
  },
  referencia_id: mongoose.Schema.Types.ObjectId,
  leida: { type: Boolean, default: false },
  leida_en: Date,
  correo_enviado: { type: Boolean, default: false },
  correo_enviado_en: Date,
  correo_error: String,
  creado_en: { type: Date, default: Date.now }
}, {
  collection: 'notificaciones',
  versionKey: false
});

module.exports = mongoose.model('Notificacion', notificacionSchema);
