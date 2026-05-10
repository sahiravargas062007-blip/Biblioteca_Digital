const mongoose = require('mongoose');

const administradorSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  activo: { type: Boolean, default: true },
  creado_en: { type: Date, default: Date.now },
  ultimo_acceso: Date
}, {
  collection: 'administradores',
  versionKey: false
});

module.exports = mongoose.model('Administrador', administradorSchema);
