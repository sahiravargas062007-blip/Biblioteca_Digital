const mongoose = require('mongoose');

const devolucionSchema = new mongoose.Schema({
  prestamo: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestamo', required: true },
  itemPrestamo: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemPrestamo', required: true },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  recibidoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrador' },
  estadoEjemplar: { type: String, enum: ['disponible', 'danado', 'perdido'], default: 'disponible' },
  observaciones: String,
  fecha: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Devolucion', devolucionSchema);
