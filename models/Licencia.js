const mongoose = require('mongoose');

const licenciaSchema = new mongoose.Schema({
  recurso: { type: mongoose.Schema.Types.ObjectId, ref: 'Recurso', required: true, unique: true },
  tipo: { type: String, enum: ['libre', 'restringida'], required: true },
  cantidad: { type: Number, default: 1 },
  duracion: {
    valor: { type: Number, default: 1 },
    unidad: { type: String, enum: ['horas', 'dias', 'semanas'], default: 'dias' }
  },
  maxPrestamosPorUsuario: Number,
  fechaVencimiento: Date,
  colaReservasHabilitada: { type: Boolean, default: false },
  tiempoMaximoEsperaReservaHoras: Number,
  activa: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Licencia', licenciaSchema);
