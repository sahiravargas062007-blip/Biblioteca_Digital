const mongoose = require('mongoose');

const ldapUsuarioMockSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true, trim: true },
  correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
  nombre: { type: String, required: true, trim: true },
  documento: { type: String, required: true, unique: true, trim: true },
  tipo_documento: { type: String, default: 'CC', trim: true },
  programa_formacion: { type: String, trim: true },
  ficha: { type: String, trim: true },
  tipo_usuario: {
    type: String,
    enum: ['Aprendiz', 'Instructor', 'Funcionario'],
    default: 'Aprendiz'
  },
  estado_sena: {
    type: String,
    enum: ['Activo', 'Inactivo'],
    default: 'Activo'
  },
  password_hash: { type: String, required: true },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  creado_en: { type: Date, default: Date.now }
}, {
  collection: 'ldap_mock',
  versionKey: false
});

module.exports = mongoose.model('LdapUsuarioMock', ldapUsuarioMockSchema);
