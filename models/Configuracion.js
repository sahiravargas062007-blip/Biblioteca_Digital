const mongoose = require('mongoose');

const configuracionSchema = new mongoose.Schema({
  prestamos_fisicos: {
    max_recursos_por_usuario: { type: Number, default: 3 },
    dias_prestamo_defecto: { type: Number, default: 15 },
    dias_renovacion: { type: Number, default: 7 },
    max_renovaciones: { type: Number, default: 1 },
    dias_tolerancia: { type: Number, default: 2 },
    tiempos_por_categoria: [{
      categoria_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Categoria' },
      categoria_nombre: String,
      dias: Number,
      subcategorias: [{
        subcategoria_id: mongoose.Schema.Types.ObjectId,
        subcategoria_nombre: String,
        dias: Number
      }]
    }]
  },
  prestamos_digitales: {
    max_prestamos_por_usuario: { type: Number, default: 5 },
    duracion_defecto_dias: { type: Number, default: 7 },
    renovaciones_permitidas: { type: Number, default: 0 },
    reservas_habilitadas: { type: Boolean, default: true },
    tiempo_max_espera_cola_dias: { type: Number, default: 30 },
    usuarios_simultaneos: { type: Number, default: 1 },
    unidad_duracion: { type: String, default: 'dias', enum: ['horas', 'dias', 'semanas'] }
  },
  reservas: {
    max_reservas_por_usuario: { type: Number, default: 3 },
    tiempo_max_reclamo_horas: { type: Number, default: 24 }
  },
  sanciones: {
    incluir_multas: { type: Boolean, default: false },
    multa_valor_dia: { type: Number, default: 100 },
    retraso_leve_max_dias: { type: Number, default: 3 },
    retraso_moderada_max_dias: { type: Number, default: 7 },
    reglas: [{
      tipo_incidencia: {
        type: String,
        enum: ['Retraso', 'Daño', 'Pérdida']
      },
      gravedad: {
        type: String,
        enum: ['Leve', 'Moderada', 'Grave']
      },
      tipo_sancion: {
        type: String,
        enum: ['Advertencia', 'Suspensión', 'Reposición']
      },
      dias_suspension: { type: Number, default: 0 },
      suspension_adicional: { type: Boolean, default: false }
    }]
  },
  actualizado_por: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrador' },
  actualizado_en: { type: Date, default: Date.now }
}, {
  collection: 'configuracion',
  versionKey: false
});

module.exports = mongoose.model('Configuracion', configuracionSchema);
