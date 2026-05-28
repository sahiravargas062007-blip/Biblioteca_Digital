const mongoose = require('mongoose');

const sancionSchema = new mongoose.Schema({
  usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  usuario_nombre: { type: String, required: true },
  usuario_documento: { type: String, required: true, index: true },
  prestamo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestamo' },
  item_prestamo_id: mongoose.Schema.Types.ObjectId,
  recurso_titulo: String,
  ejemplar_codigo: String,
  tipo_incidencia: {
    type: String,
    enum: ['Retraso', 'Daño', 'Pérdida'],
    required: true
  },
  gravedad: {
    type: String,
    enum: ['Leve', 'Moderada', 'Grave'],
    required: true
  },
  tipo_sancion: {
    type: String,
    enum: ['Advertencia', 'Suspensión', 'Reposición'],
    required: true
  },
  observaciones: String,
  dias_suspension: { type: Number, default: 0 },
  reposicion_confirmada: { type: Boolean, default: false },
  fecha_inicio: { type: Date, default: Date.now },
  fecha_fin: Date,
  incluye_multa: { type: Boolean, default: false },
  valor_multa: { type: Number, default: 0 },
  estado: {
    type: String,
    enum: ['Activa', 'Levantada'],
    default: 'Activa'
  },
  levantada_por: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrador' },
  levantada_por_nombre: String,
  fecha_levantamiento: Date,
  motivo_levantamiento: String,
  registrada_por: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrador' },
  registrada_por_nombre: String,
  creado_en: { type: Date, default: Date.now },
  actualizado_en: { type: Date, default: Date.now }
}, {
  collection: 'sanciones',
  versionKey: false
});

sancionSchema.pre('save', function setUpdatedAt(next) {
  this.actualizado_en = new Date();
  next();
});

module.exports = mongoose.model('Sancion', sancionSchema);
