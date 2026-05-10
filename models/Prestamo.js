const mongoose = require('mongoose');

const itemPrestamoSchema = new mongoose.Schema({
  recurso_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Recurso', required: true },
  recurso_titulo: { type: String, required: true },
  ejemplar_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ejemplar' },
  codigo_inventario: String,
  formato_tipo: {
    type: String,
    enum: ['pdf', 'epub', 'mp3', 'mp4', null],
    default: null
  },
  fecha_inicio: { type: Date, default: Date.now },
  fecha_limite: { type: Date, required: true },
  fecha_devolucion_real: Date,
  dias_tolerancia: { type: Number, default: 0 },
  estado: {
    type: String,
    enum: ['Activo', 'Devuelto', 'Devuelto con daño', 'Vencido', 'Perdido'],
    default: 'Activo'
  },
  renovado: { type: Boolean, default: false },
  fecha_renovacion: Date,
  nueva_fecha_limite: Date,
  renovado_por: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrador' },
  devolucion: {
    fecha: Date,
    observaciones: String,
    estado_ejemplar_al_devolver: {
      type: String,
      enum: ['Bueno', 'Dañado', 'Perdido', null],
      default: null
    },
    registrado_por: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrador' }
  }
}, { _id: true, versionKey: false });

const prestamoSchema = new mongoose.Schema({
  usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  usuario_nombre: { type: String, required: true },
  usuario_documento: { type: String, required: true, index: true },
  registrado_por: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrador' },
  tipo: {
    type: String,
    enum: ['Físico', 'Digital'],
    required: true
  },
  items: [itemPrestamoSchema],
  estado: {
    type: String,
    enum: ['Activo', 'Parcialmente devuelto', 'Vencido', 'Devuelto', 'Pendiente de reposición'],
    default: 'Activo'
  },
  tiene_sancion: { type: Boolean, default: false },
  sancion_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Sancion' },
  creado_en: { type: Date, default: Date.now },
  actualizado_en: { type: Date, default: Date.now }
}, {
  collection: 'prestamos',
  versionKey: false
});

prestamoSchema.pre('save', function setUpdatedAt(next) {
  this.actualizado_en = new Date();
  next();
});

module.exports = mongoose.model('Prestamo', prestamoSchema);
