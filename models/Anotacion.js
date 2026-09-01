const mongoose = require('mongoose');

const anotacionSchema = new mongoose.Schema({
  usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  recurso_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Recurso', required: true, index: true },
  tipo: { type: String, enum: ['highlight', 'underline', 'note', 'bookmark'], required: true },
  texto: { type: String },
  cfi: { type: String, required: true },
  color: { type: String, default: '#ffff00' },
  fecha: { type: Date, default: Date.now }
}, {
  collection: 'anotaciones',
  versionKey: false
});

module.exports = mongoose.model('Anotacion', anotacionSchema);
