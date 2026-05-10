const mongoose = require('mongoose');

const reservaSchema = new mongoose.Schema({
  usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  usuario_nombre: { type: String, required: true },
  usuario_documento: { type: String, required: true, index: true },
  recurso_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Recurso', required: true, index: true },
  recurso_titulo: { type: String, required: true },
  recurso_imagen: String,
  tipo: {
    type: String,
    enum: ['Físico', 'Digital'],
    required: true
  },
  posicion: { type: Number, required: true },
  estado: {
    type: String,
    enum: ['Pendiente', 'Disponible para reclamar', 'Completada', 'Expirada', 'Cancelada'],
    default: 'Pendiente'
  },
  fecha_reserva: { type: Date, default: Date.now },
  fecha_disponible: Date,
  fecha_limite_reclamo: Date,
  fecha_resolucion: Date,
  prestamo_generado_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestamo' },
  cancelada_por: {
    type: String,
    enum: ['usuario', 'administrador', 'sistema', null],
    default: null
  },
  motivo_cancelacion: String,
  registrado_por: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrador' },
  creado_en: { type: Date, default: Date.now },
  actualizado_en: { type: Date, default: Date.now }
}, {
  collection: 'reservas',
  versionKey: false
});

reservaSchema.index({ usuario_id: 1, recurso_id: 1, tipo: 1, estado: 1 });

reservaSchema.pre('save', function setUpdatedAt(next) {
  this.actualizado_en = new Date();
  next();
});

module.exports = mongoose.model('Reserva', reservaSchema);
