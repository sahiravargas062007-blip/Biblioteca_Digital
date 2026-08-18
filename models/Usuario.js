const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  documento: { type: String, unique: true, sparse: true, trim: true },
  tipo_documento: { type: String, default: 'CC', trim: true },
  correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: String,
  emailVerified: { type: Boolean, default: false },
  verificationCode: String,
  verificationCodeExpires: Date,
  verificationAttempts: { type: Number, default: 0 },
  resetCodeHash: String,
  resetCodeExpires: Date,
  resetAttempts: { type: Number, default: 0 },
  telefono: { type: String, trim: true },
  estado: {
    type: String,
    enum: ['Activo', 'Sancionado', 'Suspendido', 'No Verificado'],
    default: 'No Verificado'
  },
  prestamos_activos: { type: Number, default: 0 },
  reservas_activas: { type: Number, default: 0 },
  creado_en: { type: Date, default: Date.now },
  actualizado_en: { type: Date, default: Date.now },
  intentos_login: { type: Number, default: 0 },
  bloqueo_login_hasta: { type: Date, default: null }
}, {
  collection: 'usuarios',
  versionKey: false
});

usuarioSchema.pre('save', function setUpdatedAt(next) {
  this.actualizado_en = new Date();
  next();
});

module.exports = mongoose.model('Usuario', usuarioSchema);
