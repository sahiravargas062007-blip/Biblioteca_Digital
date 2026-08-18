const mongoose = require('mongoose');
const Categoria = require('../../../models/Categoria');
const Ejemplar  = require('../../../models/Ejemplar');
const { subirBuffer } = require('../../../services/cloudinaryService');
const {
  asArray,
  normalizeTipoNaturaleza,
  generarPublicId,
  subirArchivoCloudinary,
  prefixFromCategoria,
  UPLOAD_PRESET,
} = require('./helpers');

async function cargarCategoriasSeleccionadas(body) {
  const categoriaIds    = asArray(body.categoria_id);
  const subcategoriaIds = asArray(body.subcategoria_id);
  const categorias = [];

  for (let i = 0; i < categoriaIds.length; i++) {
    const categoriaId = categoriaIds[i];
    if (!mongoose.isValidObjectId(categoriaId)) continue;

    const categoria = await Categoria.findById(categoriaId);
    if (!categoria) continue;

    const subcategoriaId = subcategoriaIds[i];
    const subcategoria   = categoria.subcategorias.id(subcategoriaId);

    categorias.push({
      categoria_id:        categoria._id,
      categoria_nombre:    categoria.nombre,
      subcategoria_id:     subcategoria?._id,
      subcategoria_nombre: subcategoria?.nombre,
    });
  }

  return categorias;
}

function buildDigital(body) {
  const tipoNaturaleza = normalizeTipoNaturaleza(body.tipo_naturaleza);
  if (!['Digital', 'Mixto'].includes(tipoNaturaleza)) return undefined;

  const archivos   = [];
  const archivoUrl  = String(body.archivo_url  || '').trim();
  const archivoTipo = String(body.archivo_tipo || '').trim();
  const audioUrl    = String(body.audio_url    || '').trim();

  if (archivoUrl && archivoTipo) {
    archivos.push({
      tipo: archivoTipo, url: archivoUrl, public_id: '',
      es_principal: true, tamano_bytes: 0, subido_en: new Date(),
    });
  }

  if (audioUrl) {
    archivos.push({
      tipo: 'mp3', url: audioUrl, public_id: '', es_principal: false,
      duracion_segundos: Number(body.duracion_segundos || 0),
      tamano_bytes: 0, subido_en: new Date(),
    });
  }

  const tipoLicencia = body.tipo_licencia || 'Libre';

  return {
    tipo_licencia: tipoLicencia,
    archivos,
    licencia: tipoLicencia === 'Restringida'
      ? {
          usuarios_simultaneos:        Number(body.usuarios_simultaneos || 1),
          duracion_prestamo:           Number(body.duracion_prestamo || 7),
          unidad_duracion:             body.unidad_duracion || 'dias',
          max_prestamos_por_usuario:   Number(body.max_prestamos_por_usuario || 1),
          renovaciones_permitidas:     0,
          cola_reservas_habilitada:    body.cola_reservas_habilitada === 'true',
          tiempo_max_espera_cola_dias: Number(body.tiempo_max_espera_cola_dias || 30),
          fecha_vencimiento_licencia:  body.fecha_vencimiento_licencia
            ? new Date(body.fecha_vencimiento_licencia) : undefined,
          licencia_activa: true,
        }
      : undefined,
    licencias_en_uso:      0,
    estado_disponibilidad: tipoLicencia === 'Libre' ? 'Acceso libre' : 'Disponible',
  };
}

function buildFisico(body) {
  const tipoNaturaleza = normalizeTipoNaturaleza(body.tipo_naturaleza);
  if (!['Físico', 'Mixto'].includes(tipoNaturaleza)) return undefined;
  const total = Math.max(0, Number(body.total_ejemplares || 0));
  return {
    total_ejemplares:       total,
    ejemplares_disponibles: total,
    url_externa:            String(body.url_externa || '').trim() || null,
  };
}

async function buildRecursoPayload(req) {
  const categorias = await cargarCategoriasSeleccionadas(req.body);
  const publicado  = req.body.publicado === 'true';
  const titulo     = String(req.body.titulo || '').trim();
  const tipoNaturaleza = normalizeTipoNaturaleza(req.body.tipo_naturaleza);

  // ── PORTADA ──────────────────────────────────────────────────────────
  let imagen = { url: '/img/placeholder.png', public_id: '', es_default: true };

  const imagenFile = req.files?.imagen?.[0];
  if (imagenFile) {
    const publicId = generarPublicId(titulo, 'portadas');
    const result   = await subirBuffer(imagenFile.buffer, {
      resource_type: 'image',
      public_id:     publicId,
      upload_preset: UPLOAD_PRESET,
    });
    imagen = { url: result.secure_url, public_id: result.public_id, es_default: false };
  } else if (String(req.body.imagen_url || '').trim()) {
    imagen = { url: req.body.imagen_url.trim(), public_id: '', es_default: false };
  }

  // ── ARCHIVO PRINCIPAL ───────────────────────────────────────────────
  let digitalPayload = buildDigital(req.body);

  const archivoFile = req.files?.archivo?.[0];
  if (archivoFile && ['Digital', 'Mixto'].includes(tipoNaturaleza)) {
    // subirArchivoCloudinary elige automáticamente normal vs chunked según tamaño
    const subido = await subirArchivoCloudinary(
      archivoFile.buffer,
      archivoFile.originalname,
      archivoFile.mimetype,
      titulo
    );

    const nuevoArchivo = {
      tipo:         subido.ext,
      url:          subido.url,
      public_id:    subido.public_id,
      es_principal: true,
      tamano_bytes: subido.tamano_bytes,
      subido_en:    new Date(),
    };

    if (!digitalPayload) {
      digitalPayload = {
        tipo_licencia:         req.body.tipo_licencia || 'Libre',
        archivos:              [nuevoArchivo],
        licencias_en_uso:      0,
        estado_disponibilidad: 'Disponible',
      };
    } else {
      const sinPrincipal = (digitalPayload.archivos || []).filter((a) => !a.es_principal);
      digitalPayload.archivos = [nuevoArchivo, ...sinPrincipal];
    }
  }

  const payload = {
    tipo_naturaleza:   tipoNaturaleza,
    tipo_contenido:    req.body.tipo_contenido,
    tipo_material:     req.body.tipo_material,
    titulo,
    autor:             String(req.body.autor       || '').trim(),
    narrador:          String(req.body.narrador     || '').trim() || undefined,
    director:          String(req.body.director     || '').trim() || undefined,
    productora:        String(req.body.productora   || '').trim() || undefined,
    resolucion:        String(req.body.resolucion    || '').trim() || undefined,
    descripcion:       String(req.body.descripcion  || '').trim(),
    idioma:            String(req.body.idioma        || '').trim(),
    fecha_publicacion: req.body.fecha_publicacion
      ? new Date(req.body.fecha_publicacion) : undefined,
    editorial:         String(req.body.editorial    || '').trim(),
    isbn:              String(req.body.isbn          || '').trim(),
    cantidad_paginas:  req.body.cantidad_paginas
      ? Number(req.body.cantidad_paginas) : undefined,
    duracion_segundos: req.body.duracion_segundos
      ? Number(req.body.duracion_segundos) : undefined,
    imagen,
    categorias,
    estado: req.body.estado || (publicado ? 'Activo' : 'Pendiente de configuración'),
    digital:           digitalPayload,
    fisico:            buildFisico(req.body),
    publicado,
    publicado_en:      publicado ? new Date() : undefined,
    actualizado_en:    new Date(),
  };

  if (req.body.tipo_contenido === 'Lectura') {
    const { validarMetadatos } = require('../../../validators/metadatos.validator');
    const validation = validarMetadatos(req.body.tipo_material, req.body.metadatos || {});
    if (!validation.valido) {
      const err = new Error(validation.error);
      err.isValidationError = true;
      throw err;
    }
    payload.metadatos = validation.metadatos;
  }

  if (mongoose.isValidObjectId(req.session?.adminId)) {
    payload.registrado_por = req.session.adminId;
  }

  return payload;
}

async function crearEjemplaresParaRecurso(recurso, cantidad) {
  if (!cantidad || cantidad < 1) return;

  const categoriaNombre = recurso.categorias[0]?.categoria_nombre || 'Recurso';
  const prefix          = prefixFromCategoria(categoriaNombre);
  const existentes      = await Ejemplar.countDocuments({
    codigo_inventario: new RegExp(`^${prefix}-`),
  });
  const docs = [];

  for (let i = 1; i <= cantidad; i++) {
    const numero = String(existentes + i).padStart(4, '0');
    docs.push({
      recurso_id:        recurso._id,
      recurso_titulo:    recurso.titulo,
      codigo_inventario: `${prefix}-${numero}`,
      estado:            'Disponible',
      historial_estados: [],
      creado_en:         new Date(),
      actualizado_en:    new Date(),
    });
  }

  await Ejemplar.insertMany(docs);
}

function buildCatalogFilter(query = {}) {
  const q = String(query.q || '').trim();
  const tipoContenido = String(query.tipo_contenido || '').trim();
  const tipoMateriales = query.tipo_material ? String(query.tipo_material).split(',').filter(Boolean) : [];
  const categoriasIds = query.categorias ? String(query.categorias).split(',').filter(Boolean) : [];
  const subcatsIds = query.subcategorias ? String(query.subcategorias).split(',').filter(Boolean) : [];
  const categoriaId = String(query.categoria_id || '').trim();
  const estado = String(query.estado || '').trim();

  const filtro = {};
  if (q) {
    filtro.$or = [
      { titulo: new RegExp(q, 'i') },
      { autor: new RegExp(q, 'i') },
      { isbn: new RegExp(q, 'i') },
      { 'categorias.categoria_nombre': new RegExp(q, 'i') },
      { 'categorias.subcategoria_nombre': new RegExp(q, 'i') },
    ];
  }
  if (tipoContenido) filtro.tipo_contenido = tipoContenido;
  if (tipoMateriales.length) filtro.tipo_material = { $in: tipoMateriales };
  if (estado) filtro.estado = estado;
  if (mongoose.isValidObjectId(categoriaId)) filtro['categorias.categoria_id'] = categoriaId;
  if (categoriasIds.length) {
    const validIds = categoriasIds.filter((id) => mongoose.isValidObjectId(id));
    if (validIds.length) filtro['categorias.categoria_id'] = { $in: validIds };
  }
  if (subcatsIds.length) {
    const validIds = subcatsIds.filter((id) => mongoose.isValidObjectId(id));
    if (validIds.length) filtro['categorias.subcategoria_id'] = { $in: validIds };
  }

  return {
    filtro,
    filtros: { q, tipo_contenido: tipoContenido, categoria_id: categoriaId, estado }
  };
}

module.exports = {
  cargarCategoriasSeleccionadas,
  buildDigital,
  buildFisico,
  buildRecursoPayload,
  crearEjemplaresParaRecurso,
  buildCatalogFilter,
};
