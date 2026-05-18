const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  ldap_uid: { type: String, required: true, unique: true, trim: true },
  nombre: { type: String, required: true, trim: true },
  documento: { type: String, required: true, unique: true, trim: true },
  tipo_documento: { type: String, default: 'CC', trim: true },
  correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  programa_formacion: { type: String, trim: true },
  ficha: { type: String, trim: true },
  telefono: { type: String, trim: true },
  estado: {
    type: String,
    enum: ['Activo', 'Sancionado', 'Suspendido', 'Pendiente de aprobación', 'Rechazado'],
    default: 'Pendiente de aprobación'
  },
  aprobado_por: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrador' },
  aprobado_en: Date,
  prestamos_activos: { type: Number, default: 0 },
  reservas_activas: { type: Number, default: 0 },
  creado_en: { type: Date, default: Date.now },
  actualizado_en: { type: Date, default: Date.now }
}, {
  collection: 'usuarios',
  versionKey: false
});

usuarioSchema.pre('save', function setUpdatedAt(next) {
  this.actualizado_en = new Date();
  next();
});

module.exports = mongoose.model('Usuario', usuarioSchema);
