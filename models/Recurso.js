const mongoose = require('mongoose');

const archivoDigitalSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['pdf', 'epub', 'mp3', 'mp4', 'url'],
    required: true
  },
  url: { type: String, required: true },
  public_id: String,
  es_principal: { type: Boolean, default: false },
  duracion_segundos: Number,
  tamano_bytes: Number,
  subido_en: { type: Date, default: Date.now }
}, { _id: true, versionKey: false });

const categoriaRecursoSchema = new mongoose.Schema({
  categoria_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Categoria', required: true },
  categoria_nombre: { type: String, required: true },
  subcategoria_id: mongoose.Schema.Types.ObjectId,
  subcategoria_nombre: String
}, { _id: false, versionKey: false });

const recursoSchema = new mongoose.Schema({
  tipo_naturaleza: {
    type: String,
    enum: ['Digital', 'Físico', 'Mixto'],
    required: true
  },
  tipo_contenido: {
    type: String,
    enum: ['Lectura', 'Audio', 'Video'],
    required: true
  },
  tipo_material: {
    type: String,
    enum: ['Libro', 'Revista', 'Tesis', 'Artículo', 'Ley y Normativa', 'Mapa', 'Audiolibro', 'Video'],
    required: true
  },
  titulo: { type: String, required: true, trim: true, index: true },
  autor: { type: String, required: true, trim: true },
  descripcion: { type: String, required: true, trim: true },
  idioma: { type: String, trim: true },
  fecha_publicacion: Date,
  editorial: { type: String, trim: true },
  isbn: { type: String, trim: true, index: true },
  cantidad_paginas: Number,
  duracion_segundos: Number,
  imagen: {
    url: String,
    public_id: String,
    es_default: { type: Boolean, default: true }
  },
  categorias: [categoriaRecursoSchema],
  estado: {
    type: String,
    enum: ['Activo', 'Inactivo', 'Pendiente de configuración', 'Bloqueado'],
    default: 'Pendiente de configuración'
  },
  digital: {
    tipo_licencia: {
      type: String,
      enum: ['Libre', 'Restringida']
    },
    archivos: [archivoDigitalSchema],
    licencia: {
      usuarios_simultaneos: { type: Number, default: 1 },
      duracion_prestamo: Number,
      unidad_duracion: {
        type: String,
        enum: ['horas', 'dias', 'semanas']
      },
      max_prestamos_por_usuario: Number,
      renovaciones_permitidas: { type: Number, default: 0 },
      cola_reservas_habilitada: { type: Boolean, default: false },
      tiempo_max_espera_cola_dias: Number,
      fecha_vencimiento_licencia: Date,
      licencia_activa: { type: Boolean, default: true }
    },
    licencias_en_uso: { type: Number, default: 0 },
    estado_disponibilidad: {
      type: String,
      enum: ['Disponible', 'No disponible', 'Acceso libre', 'Restringido', 'Licencia vencida']
    }
  },
  fisico: {
    total_ejemplares: { type: Number, default: 0 },
    ejemplares_disponibles: { type: Number, default: 0 },
    url_externa: String
  },
  registrado_por: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrador' },
  publicado: { type: Boolean, default: false },
  publicado_en: Date,
  total_prestamos: { type: Number, default: 0 },
  total_reservas: { type: Number, default: 0 },
  creado_en: { type: Date, default: Date.now },
  actualizado_en: { type: Date, default: Date.now }
}, {
  collection: 'recursos',
  versionKey: false
});

recursoSchema.pre('save', function setUpdatedAt(next) {
  this.actualizado_en = new Date();
  next();
});

module.exports = mongoose.model('Recurso', recursoSchema);
