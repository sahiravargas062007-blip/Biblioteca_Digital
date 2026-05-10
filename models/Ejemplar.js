const mongoose = require('mongoose');

const historialEstadoSchema = new mongoose.Schema({
  estado_anterior: String,
  estado_nuevo: String,
  cambiado_por: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrador' },
  cambiado_en: { type: Date, default: Date.now },
  observacion: String
}, { _id: false, versionKey: false });

const ejemplarSchema = new mongoose.Schema({
  recurso_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Recurso', required: true, index: true },
  recurso_titulo: { type: String, required: true },
  codigo_inventario: { type: String, required: true, unique: true, index: true },
  estado: {
    type: String,
    enum: ['Disponible', 'Prestado', 'Dañado', 'Perdido', 'No disponible'],
    default: 'Disponible'
  },
  historial_estados: [historialEstadoSchema],
  descripcion_dano: String,
  creado_en: { type: Date, default: Date.now },
  actualizado_en: { type: Date, default: Date.now }
}, {
  collection: 'ejemplares',
  versionKey: false
});

ejemplarSchema.pre('save', function setUpdatedAt(next) {
  this.actualizado_en = new Date();
  next();
});

module.exports = mongoose.model('Ejemplar', ejemplarSchema);
