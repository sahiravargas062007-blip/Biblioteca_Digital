const mongoose = require('mongoose');

const formatoSchema = new mongoose.Schema({
  recurso: { type: mongoose.Schema.Types.ObjectId, ref: 'Recurso', required: true },
  tipo: { type: String, enum: ['pdf', 'epub', 'mp3', 'mp4', 'url'], required: true },
  url: { type: String, required: true },
  publicId: String,
  nombreOriginal: String,
  mimeType: String,
  duracionSegundos: Number,
  descargaPermitida: { type: Boolean, default: false },
  principal: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Formato', formatoSchema);
