const mongoose = require('mongoose');

const subcategoriaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  codigo_dewey: { type: String, trim: true },
  descripcion: { type: String, trim: true }
}, {
  _id: true,
  versionKey: false
});

const categoriaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true, trim: true },
  codigo_dewey: { type: String, trim: true, index: true },
  descripcion: { type: String, trim: true },
  subcategorias: [subcategoriaSchema],
  total_recursos: { type: Number, default: 0 },
  activa: { type: Boolean, default: true },
  creado_en: { type: Date, default: Date.now },
  actualizado_en: { type: Date, default: Date.now }
}, {
  collection: 'categorias',
  versionKey: false
});

categoriaSchema.pre('save', function setUpdatedAt(next) {
  this.actualizado_en = new Date();
  next();
});

module.exports = mongoose.model('Categoria', categoriaSchema);
