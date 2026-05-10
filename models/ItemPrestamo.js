const mongoose = require('mongoose');

const itemPrestamoSchema = new mongoose.Schema({
  prestamo: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestamo', required: true },
  recurso: { type: mongoose.Schema.Types.ObjectId, ref: 'Recurso', required: true },
  ejemplar: { type: mongoose.Schema.Types.ObjectId, ref: 'Ejemplar' },
  formato: { type: mongoose.Schema.Types.ObjectId, ref: 'Formato' },
  modalidad: { type: String, enum: ['fisico', 'digital'], required: true },
  fechaInicio: { type: Date, default: Date.now },
  fechaLimite: { type: Date, required: true },
  fechaDevolucion: Date,
  renovaciones: { type: Number, default: 0 },
  estado: { type: String, enum: ['activo', 'vencido', 'devuelto', 'perdido'], default: 'activo' }
}, { timestamps: true });

module.exports = mongoose.model('ItemPrestamo', itemPrestamoSchema);
