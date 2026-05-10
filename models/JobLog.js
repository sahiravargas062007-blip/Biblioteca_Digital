const mongoose = require('mongoose');

const jobLogSchema = new mongoose.Schema({
  job: {
    type: String,
    enum: ['verificarVencimientos', 'verificarReservas', 'enviarRecordatorios'],
    required: true
  },
  ejecutado_en: { type: Date, default: Date.now },
  duracion_ms: { type: Number, default: 0 },
  resultado: {
    prestamos_actualizados: { type: Number, default: 0 },
    reservas_expiradas: { type: Number, default: 0 },
    correos_enviados: { type: Number, default: 0 },
    errores: { type: [String], default: [] }
  },
  estado: {
    type: String,
    enum: ['exitoso', 'fallido'],
    required: true
  }
}, {
  collection: 'jobs_log',
  versionKey: false
});

module.exports = mongoose.model('JobLog', jobLogSchema);
