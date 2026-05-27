const mongoose = require('mongoose');
const AdmZip = require('adm-zip');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { validationResult } = require('express-validator');
const Categoria = require('../../models/Categoria');
const Ejemplar  = require('../../models/Ejemplar');
const Recurso   = require('../../models/Recurso');
const {
  subirBuffer,
  subirBufferGrande,
  eliminar
} = require('../../services/cloudinaryService');

// â”€â”€ Umbral para usar upload chunked (archivos > 90 MB van por chunks) â”€â”€â”€â”€â”€â”€â”€â”€â”€
const UMBRAL_CHUNKED = 90 * 1024 * 1024;

// â”€â”€ Tipos de archivo que necesitan chunked upload (videos generalmente) â”€â”€â”€â”€â”€â”€â”€â”€
const VIDEO_EXTS = new Set(['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', 'wmv']);

// â”€â”€ Extensiones válidas de imagen / portada â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

// â”€â”€ Upload Preset de Cloudinary (RN5) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || 'Biblioteca_name';

// â”€â”€ Resource type correcto para Cloudinary según extensión â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function cloudinaryResourceType(ext) {
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'm4b', 'm4a', 'ogg', 'aac', 'flac', 'wma'].includes(ext)) return 'video';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return 'raw';
}

// â”€â”€ Extensión desde mimetype â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function extFromMime(mime) {
  const map = {
    'application/pdf':      'pdf',
    'application/epub+zip': 'epub',
    'audio/mpeg':           'mp3',
    'audio/mp4':            'm4a',
    'audio/wav':            'wav',
    'audio/ogg':            'ogg',
    'audio/aac':            'aac',
    'audio/flac':           'flac',
    'video/mp4':            'mp4',
    'video/webm':           'webm',
    'video/avi':            'avi',
    'video/quicktime':      'mov',
  };
  return map[mime] || 'bin';
}

// â”€â”€ Genera public_id limpio para Cloudinary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function generarPublicId(titulo, carpeta) {
  const nombre = String(titulo || 'recurso')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase()
    .slice(0, 60);
  return `biblioteca/${carpeta}/${nombre}_${Date.now()}`;
}

// â”€â”€ Sube archivo a Cloudinary (automáticamente elige normal o chunked) â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function subirArchivoCloudinary(fileBuffer, originalname, mimetype, titulo) {
  const ext = originalname.includes('.')
    ? originalname.split('.').pop().toLowerCase()
    : extFromMime(mimetype);

  const resourceType = cloudinaryResourceType(ext);
  const publicId     = generarPublicId(titulo, ext);
  const options      = {
    resource_type: resourceType,
    public_id:     publicId,
    upload_preset: UPLOAD_PRESET,   // RN5: preset en todas las subidas
  };

  // Archivos de video grandes â†’ chunked upload para evitar timeout
  const usarChunked =
    VIDEO_EXTS.has(ext) || fileBuffer.length > UMBRAL_CHUNKED;

  const result = usarChunked
    ? await subirBufferGrande(fileBuffer, options)
    : await subirBuffer(fileBuffer, options);

  return {
    url:          result.secure_url,
    public_id:    result.public_id,
    tamano_bytes: result.bytes || fileBuffer.length,
    ext,
  };
}

function flash(req, type, message) {
  req.session.flash = { type, message };
}

function normalizarTexto(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}
function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSearchKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function normalizeTipoMaterial(value) {
  const raw = String(value || '').trim();
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .toLowerCase();

  const tipoMap = {
    libro: 'Libro',
    revista: 'Revista',
    tesis: 'Tesis',
    articulo: 'Artículo',
    'articulo': 'Artículo',
    'ley y normativa': 'Ley y Normativa',
    normativa: 'Ley y Normativa',
    ley: 'Ley y Normativa',
    mapa: 'Mapa',
    audiolibro: 'Audiolibro',
    audio: 'Audiolibro',
    video: 'Video',
  };

  for (const [key, mapped] of Object.entries(tipoMap)) {
    if (normalized === key || normalized.includes(key)) {
      return mapped;
    }
  }

  const allowed = [
    'Libro',
    'Revista',
    'Tesis',
    'Artículo',
    'Ley y Normativa',
    'Mapa',
    'Audiolibro',
    'Video',
  ];

  return allowed.includes(raw) ? raw : null;
}

function buildFlexibleTextRegex(text) {
  const normalized = normalizeSearchKey(text);
  if (!normalized) return null;

  const pattern = normalized
    .split('')
    .map((char) => escapeRegExp(char))
    .join('[^a-z0-9]*');

  return new RegExp(pattern, 'i');
}

function prefixFromCategoria(categoriaNombre) {
  const normalized = normalizarTexto(categoriaNombre);
  return (normalized.slice(0, 3) || 'REC').padEnd(3, 'X');
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeTipoNaturaleza(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (normalized === 'fisico') return 'Físico';
  if (normalized === 'mixto') return 'Mixto';
  return 'Digital';
}

async function sincronizarFisicoConEjemplares(recursoId) {
  const [total, disponibles] = await Promise.all([
    Ejemplar.countDocuments({ recurso_id: recursoId }),
    Ejemplar.countDocuments({ recurso_id: recursoId, estado: 'Disponible' }),
  ]);

  await Recurso.findByIdAndUpdate(recursoId, {
    $set: {
      'fisico.total_ejemplares': total,
      'fisico.ejemplares_disponibles': disponibles,
      actualizado_en: new Date(),
    },
  });
}

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

  // â”€â”€ PORTADA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ ARCHIVO PRINCIPAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CONTROLLERS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

exports.index = async (req, res, next) => {
  try {
    const { filtro, filtros } = buildCatalogFilter(req.query);

    const [recursos, categorias, resumen] = await Promise.all([
      Recurso.find(filtro).sort({ creado_en: -1 }).lean(),
      Categoria.find({ activa: true }).sort({ nombre: 1 }).lean(),
      require('../../services/reporteService').resumen()
    ]);

    res.render('admin/recursos/index', {
      title: 'Materiales', recursos, categorias, resumen,
      filtros,
      pageClass: 'admin-catalog-page'
    });
  } catch (error) {
    next(error);
  }
};

exports.api = async (req, res, next) => {
  try {
    const { filtro } = buildCatalogFilter(req.query);
    const recursos = await Recurso.find(filtro).sort({ creado_en: -1 }).lean();

    return res.json(recursos.map((recurso) => ({
      _id: recurso._id,
      titulo: recurso.titulo,
      autor: recurso.autor,
      tipo_contenido: recurso.tipo_contenido,
      tipo_material: recurso.tipo_material,
      tipo_naturaleza: recurso.tipo_naturaleza,
      estado: recurso.estado,
      descripcion: recurso.descripcion,
      imagen: recurso.imagen,
      categorias: recurso.categorias
    })));
  } catch (error) {
    next(error);
  }
};

exports.nuevo = async (req, res, next) => {
  try {
    const categorias = await Categoria.find({ activa: true }).sort({ nombre: 1 }).lean();
    res.render('admin/recursos/nuevo', { title: 'Nuevo recurso', recurso: null, categorias });
  } catch (error) {
    next(error);
  }
};

exports.masivo = (req, res) =>
  res.render('admin/recursos/masivo', { title: 'Carga masiva' });

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HU-09: Importación de metadatos desde Excel
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.excelMetadatos = (req, res) =>
  res.render('admin/recursos/excel-metadatos', { title: 'Importar metadatos' });

exports.procesarExcelMetadatos = async (req, res, next) => {
  const { parsearExcel } = require('../../services/excelService');

  try {
    if (!req.file) {
      flash(req, 'error', 'Debe seleccionar un archivo Excel.');
      return res.redirect('/admin/recursos/excel-metadatos');
    }

    // Parsear Excel
    const { filas, errores: erroresParsingExcel } = parsearExcel(
      req.file.buffer,
      req.file.originalname
    );

    if (filas.length === 0) {
      const todoErrores = erroresParsingExcel.length
        ? erroresParsingExcel.join(' | ')
        : 'No se pudieron procesar filas.';
      flash(req, 'error', `Error al leer Excel: ${todoErrores}`);
      return res.redirect('/admin/recursos/excel-metadatos');
    }

    let exitosos = 0;
    let publicados = 0;
    const detalles = [];
    const errores = [...erroresParsingExcel];

    for (const registro of filas) {
      try {
        const nombreArchivo = String(registro.nombreArchivoOriginal || '').trim();
        const datosProcesados = { ...registro.datosProcesados };

        if (datosProcesados.tipo_material) {
          const tipoMaterialNormalizado = normalizeTipoMaterial(datosProcesados.tipo_material);
          if (tipoMaterialNormalizado) {
            datosProcesados.tipo_material = tipoMaterialNormalizado;
          } else {
            delete datosProcesados.tipo_material;
          }
        }

        // Determinar tipo_contenido basado en campos presentes
        let tipoContenido = 'Lectura';
        if (datosProcesados.narrador) {
          tipoContenido = 'Audio';
        } else if (datosProcesados.director) {
          tipoContenido = 'Video';
        }
        datosProcesados.tipo_contenido = tipoContenido;

        // Manejar imagen_url
        let imagenUpdate = {};
        if (datosProcesados.imagen_url) {
          imagenUpdate = {
            imagen: {
              url: datosProcesados.imagen_url,
              public_id: '',
              es_default: false
            }
          };
          delete datosProcesados.imagen_url;
        }

        // 1. Búsqueda por nombreArchivoOriginal (recurso previamente creado por ZIP - Escenario A)
        const recursoBuscado = await Recurso.findOne({
          nombreArchivoOriginal: { $regex: new RegExp("^" + escapeRegExp(nombreArchivo) + "$", "i") }
        });

        // 2. Búsqueda por Título o por ISBN para evitar duplicar recursos que ya existan en la base de datos
        const tituloABuscar = datosProcesados.titulo || nombreArchivo;
        const existentePorTitulo = await Recurso.findOne({
          titulo: { $regex: new RegExp("^" + escapeRegExp(tituloABuscar) + "$", "i") }
        });
        const existentePorIsbn = datosProcesados.isbn
          ? await Recurso.findOne({ isbn: datosProcesados.isbn })
          : null;

        const existente = existentePorTitulo || existentePorIsbn;

        // Si no se encuentra por nombre de archivo (nuevo escenario), pero sí existe por Título o ISBN:
        // Se debe alertar al usuario y no crearlo para evitar duplicidad.
        if (!recursoBuscado && existente) {
          errores.push(`"${nombreArchivo}": El recurso ya se encuentra creado en el sistema con el título "${existente.titulo}".`);
          continue;
        }

        const datosMerged = { ...(recursoBuscado ? recursoBuscado.toObject() : {}), ...datosProcesados };
        
        // Campos obligatorios: titulo, autor, descripcion, tipo_material (Clasificación)
        const tieneObligatorios = datosMerged.titulo && datosMerged.autor && datosMerged.descripcion && datosMerged.tipo_material;
        const tieneArchivoFisico = (recursoBuscado?.digital?.archivos?.some(a => a.es_principal)) || false;

        let nuevoEstado = 'Pendiente de configuración';
        let seraPublicado = false;
        let publicadoEn = recursoBuscado?.publicado_en;

        if (req.body.auto_publicar === 'true' && tieneObligatorios && tieneArchivoFisico) {
          nuevoEstado = 'Activo';
          seraPublicado = true;
          if (!publicadoEn) publicadoEn = new Date();
        }

        // Determinar los motivos de pendiente
        let motivosPendiente = [];
        if (!seraPublicado) {
          if (!tieneObligatorios) motivosPendiente.push('Faltan campos obligatorios');
          if (!tieneArchivoFisico) motivosPendiente.push('Falta archivo principal');
        }
        const motivoPendienteStr = motivosPendiente.join(', ');

        if (!recursoBuscado) {
          // CA4: Crear recurso nuevo en estado "Pendiente de configuración"
          const titulo = datosProcesados.titulo || nombreArchivo || 'Sin título';
          const autor = datosProcesados.autor || 'Pendiente de completar';
          const descripcion = datosProcesados.descripcion || 'Recurso creado desde Excel. Pendiente de completar metadatos.';
          const tipoMaterial = datosProcesados.tipo_material || 'Libro';

          const nuevoRecurso = {
            nombreArchivoOriginal: nombreArchivo,
            tipo_naturaleza: 'Digital',
            tipo_contenido: datosProcesados.tipo_contenido || 'Lectura',
            tipo_material: tipoMaterial,
            titulo,
            autor,
            narrador: datosProcesados.narrador,
            director: datosProcesados.director,
            productora: datosProcesados.productora,
            descripcion,
            idioma: datosProcesados.idioma || '',
            editorial: datosProcesados.editorial || '',
            isbn: datosProcesados.isbn || '',
            cantidad_paginas: datosProcesados.cantidad_paginas,
            duracion_segundos: datosProcesados.duracion_segundos,
            fecha_publicacion: datosProcesados.fecha_publicacion
              ? new Date(datosProcesados.fecha_publicacion)
              : undefined,
            imagen: datosProcesados.imagen_url
              ? { url: datosProcesados.imagen_url, public_id: '', es_default: false }
              : { url: '/img/placeholder.png', public_id: '', es_default: true },
            categorias: [],
            estado: nuevoEstado,
            publicado: seraPublicado,
            publicado_en: publicadoEn,
            digital: {
              tipo_licencia: 'Libre',
              archivos: [],
              licencias_en_uso: 0,
              estado_disponibilidad: 'Acceso libre',
            },
            total_prestamos: 0,
            total_reservas: 0,
            creado_en: new Date(),
            actualizado_en: new Date(),
            ...(mongoose.isValidObjectId(req.session?.adminId)
              ? { registrado_por: req.session.adminId }
              : {}),
          };

          const creado = await Recurso.create(nuevoRecurso);
          if (creado) {
            exitosos += 1;
            if (creado.publicado) publicados += 1;
            detalles.push({
              nombreArchivo: registro.nombreArchivoOriginal,
              titulo: creado.titulo || 'Sin título',
              publicado: creado.publicado,
              accion: 'Creado',
              motivo: motivoPendienteStr
            });
          }
        } else {
          // CA3: Actualizar con findByIdAndUpdate
          const actualizado = await Recurso.findByIdAndUpdate(
            recursoBuscado._id,
            {
              ...datosProcesados,
              ...imagenUpdate,
              estado: nuevoEstado,
              publicado: seraPublicado,
              publicado_en: publicadoEn,
              actualizado_en: new Date(),
            },
            { new: true, runValidators: true, context: 'query' }
          );

          if (actualizado) {
            exitosos += 1;
            if (actualizado.publicado) publicados += 1;

            detalles.push({
              nombreArchivo: registro.nombreArchivoOriginal,
              titulo: actualizado.titulo || 'Sin título',
              publicado: actualizado.publicado,
              accion: 'Actualizado',
              motivo: motivoPendienteStr
            });
          }
        }
      } catch (errActualizar) {
        console.error(
          `[ExcelMetadatos] Error procesando "${registro.nombreArchivoOriginal}":`,
          errActualizar
        );
        errores.push(
          `"${registro.nombreArchivoOriginal}": ${errActualizar.message}`
        );
      }
    }

    // CA-09: Reporte de resultados
    const resultados = {
      procesados: filas.length,
      exitosos,
      publicados: req.body.auto_publicar === 'true' ? publicados : 0,
      errores,
      detalles,
    };

    return res.render('admin/recursos/excel-metadatos', {
      title: 'Importar metadatos — Resultados',
      resultados,
    });
  } catch (error) {
    next(error);
  }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PASO 1 â€” POST /admin/recursos/masivo/previsualizar
// CA4: analizar el ZIP y mostrar previsualización sin guardar nada
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.previsualizarMasivo = async (req, res, next) => {
  try {
    if (!req.file) {
      flash(req, 'error', 'Debe seleccionar un archivo ZIP.');
      return res.redirect('/admin/recursos/masivo');
    }

    const tipoContenido = req.body.tipo_contenido || 'Lectura';
    const zip = new AdmZip(req.file.buffer);
    const { recursos, errores } = analizarZip(zip, tipoContenido);

    const zipTempName = `recursos-masivo-${randomUUID()}.zip`;
    const zipTempPath = path.join(os.tmpdir(), zipTempName);
    await fs.writeFile(zipTempPath, req.file.buffer);

    return res.render('admin/recursos/masivo', {
      title:         'Carga masiva â€” Vista previa',
      previsualizar: true,
      tipoContenido,
      recursos,
      errores,
      zipTempName,
    });
  } catch (error) {
    next(error);
  }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PASO 2 â€” POST /admin/recursos/masivo/confirmar
// CA5: subir a Cloudinary y guardar en MongoDB
// CA6: si cancela, no guarda nada
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.confirmarMasivo = async (req, res, next) => {
  const zipTempName = req.body.zip_temp_name;
  const zipTempPath = zipTempName ? path.join(os.tmpdir(), zipTempName) : null;
  const tipoContenido = req.body.tipo_contenido || 'Lectura';

  try {
    // CA6: cancelar sin guardar nada
    if (req.body.accion === 'cancelar') {
      if (zipTempPath) await fs.unlink(zipTempPath).catch(() => {});
      flash(req, 'info', 'Carga masiva cancelada. No se guardaron cambios.');
      return res.redirect('/admin/recursos');
    }

    if (!zipTempPath) {
      flash(req, 'error', 'No se encontró el archivo ZIP temporal. Vuelva a intentarlo.');
      return res.redirect('/admin/recursos/masivo');
    }

    const zipBuffer = await fs.readFile(zipTempPath);
    const zip = new AdmZip(zipBuffer);
    const { recursos, errores: erroresDeteccion } = analizarZip(zip, tipoContenido);

    // Enriquecer recursos con el estado de detección (igual que en previsualizar)
    const titulos = recursos.map(r => r.titulo);
    const recursosExistentes = await Recurso.find({ titulo: { $in: titulos } });

    const recursosAGuardar = [];

    for (const recurso of recursos) {
      if (!recurso.tieneMain) {
        recurso.estadoDeteccion = 'Error';
      } else {
        const existente = recursosExistentes.find(
          e => e.titulo.toLowerCase().trim() === recurso.titulo.toLowerCase().trim()
        );
        if (existente) {
          const tieneArchivoPrincipal = existente.digital?.archivos?.some(a => a.es_principal);
          if (tieneArchivoPrincipal) {
            recurso.estadoDeteccion = 'Ya existente con archivo';
          } else {
            recurso.estadoDeteccion = 'Archivo pendiente encontrado';
            recurso.existenteDoc = existente;
          }
        } else {
          recurso.estadoDeteccion = 'Nuevo';
        }
      }

      // Solo procesar Nuevos y Pendientes
      if (recurso.estadoDeteccion === 'Nuevo' || recurso.estadoDeteccion === 'Archivo pendiente encontrado') {
        recursosAGuardar.push(recurso);
      }
    }

    if (recursosAGuardar.length === 0) {
      flash(req, 'error', 'No se detectaron recursos procesables en el ZIP.');
      return res.redirect('/admin/recursos/masivo');
    }

    let creados = 0;
    let actualizados = 0;
    const erroresSubida = [];

    for (const recurso of recursosAGuardar) {
      try {
        const archivos = [];

        // Subir archivo principal a Cloudinary solo si existe
        if (recurso.mainEntry) {
          const mainBuffer = recurso.mainEntry.getData();
          const mainSubido = await subirArchivoCloudinary(
            mainBuffer,
            recurso.mainEntry.name,
            '',
            recurso.titulo
          );

          archivos.push({
            tipo:         tipoArchivoFromExt(mainSubido.ext),
            url:          mainSubido.url,
            public_id:    mainSubido.public_id,
            es_principal: true,
            tamano_bytes: mainSubido.tamano_bytes,
            subido_en:    new Date(),
          });
        }

        // Complemento de audio (solo Lectura y si hay main)
        if (recurso.complementoEntry && recurso.mainEntry) {
          const compBuffer = recurso.complementoEntry.getData();
          const compSubido = await subirArchivoCloudinary(
            compBuffer,
            recurso.complementoEntry.name,
            '',
            `${recurso.titulo}_comp`
          );
          archivos.push({
            tipo:         tipoArchivoFromExt(compSubido.ext),
            url:          compSubido.url,
            public_id:    compSubido.public_id,
            es_principal: false,
            tamano_bytes: compSubido.tamano_bytes,
            subido_en:    new Date(),
          });
        }

        // Portada: subir a Cloudinary o usar placeholder
        let imagen = { url: '/img/placeholder.png', public_id: '', es_default: true };

        if (recurso.portadaEntry) {
          const portadaBuffer = recurso.portadaEntry.getData();
          const portadaResult = await subirBuffer(portadaBuffer, {
            resource_type: 'image',
            public_id:     generarPublicId(recurso.titulo, 'portadas'),
            upload_preset: UPLOAD_PRESET,
          });
          imagen = {
            url:        portadaResult.secure_url,
            public_id:  portadaResult.public_id,
            es_default: false,
          };
        }

        if (recurso.estadoDeteccion === 'Archivo pendiente encontrado' && recurso.existenteDoc) {
          // Actualizar Recurso existente en MongoDB
          const doc = recurso.existenteDoc;

          // Mantener archivos anteriores que no sean principales si corresponde
          const archivosFiltrados = (doc.digital?.archivos || []).filter(a => !a.es_principal);
          const todosArchivos = [...archivos, ...archivosFiltrados];

          // Actualizar imagen si se subió portada nueva, si no dejar la existente
          const nuevaImagen = recurso.portadaEntry ? imagen : doc.imagen;

          await Recurso.findByIdAndUpdate(doc._id, {
            $set: {
              'digital.archivos': todosArchivos,
              imagen: nuevaImagen,
              estado: 'Pendiente de configuración',
              actualizado_en: new Date()
            }
          });
          actualizados += 1;
        } else {
          // Guardar en MongoDB con estado "Pendiente de configuración"
          await Recurso.create({
            nombreArchivoOriginal: recurso.mainEntry ? nombreBase(recurso.mainEntry.name) : recurso.titulo,
            tipo_naturaleza: 'Digital',
            tipo_contenido:  tipoContenido,
            tipo_material:   materialFromContenido(tipoContenido),
            titulo:          recurso.titulo,
            autor:           'Pendiente de completar',
            descripcion:     'Recurso cargado masivamente. Pendiente de completar metadatos.',
            idioma:          '',
            imagen,
            categorias:      [],
            estado:          'Pendiente de configuración',
            publicado:       false,
            digital: {
              tipo_licencia:         'Libre',
              archivos,
              licencias_en_uso:      0,
              estado_disponibilidad: 'Acceso libre',
            },
            fisico:          undefined,
            total_prestamos: 0,
            total_reservas:  0,
            creado_en:       new Date(),
            actualizado_en:  new Date(),
            ...(mongoose.isValidObjectId(req.session?.adminId)
              ? { registrado_por: req.session.adminId }
              : {}),
          });

          creados += 1;
        }
      } catch (errSubida) {
        console.error(`[MasivoZIP] Error al procesar "${recurso.titulo}":`, errSubida);
        erroresSubida.push(`"${recurso.titulo}": ${errSubida.message}`);
      }
    }

    const totalErrores   = [...erroresDeteccion, ...erroresSubida];
    const detalleErrores = totalErrores.length ? ` Problemas: ${totalErrores.join(' | ')}` : '';

    flash(
      req,
      totalErrores.length ? 'error' : 'success',
      `Carga completada. Recursos creados: ${creados}. Recursos actualizados: ${actualizados}.${detalleErrores}`
    );
    return res.redirect('/admin/recursos');
  } catch (error) {
    next(error);
  } finally {
    if (zipTempPath) await fs.unlink(zipTempPath).catch(() => {});
  }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RESTO DE CONTROLLERS â€” idénticos a tu versión original
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

exports.detalle = async (req, res, next) => {
  try {
    const [recurso, ejemplares] = await Promise.all([
      Recurso.findById(req.params.id).lean(),
      Ejemplar.find({ recurso_id: req.params.id }).sort({ codigo_inventario: 1 }).lean(),
    ]);

    if (!recurso) {
      flash(req, 'error', 'El recurso no existe.');
      return res.redirect('/admin/recursos');
    }

    return res.render('admin/recursos/detalle', {
      title: 'Detalle recurso', recurso, ejemplares,
    });
  } catch (error) {
    next(error);
  }
};

exports.editar = async (req, res, next) => {
  try {
    const [recurso, categorias] = await Promise.all([
      Recurso.findById(req.params.id).lean(),
      Categoria.find({ activa: true }).sort({ nombre: 1 }).lean(),
    ]);

    if (!recurso) {
      flash(req, 'error', 'El recurso no existe.');
      return res.redirect('/admin/recursos');
    }

    return res.render('admin/recursos/nuevo', {
      title: 'Editar recurso', recurso, categorias,
    });
  } catch (error) {
    next(error);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      flash(req, 'error', errors.array()[0].msg);
      return res.redirect('/admin/recursos/nuevo');
    }

    const payload    = await buildRecursoPayload(req);
    payload.creado_en = new Date();
    const recurso    = await Recurso.create(payload);
    const cantidad   = payload.fisico?.total_ejemplares || 0;
    await crearEjemplaresParaRecurso(recurso, cantidad);
    if (payload.fisico) {
      await sincronizarFisicoConEjemplares(recurso._id);
    }

    flash(req, 'success', 'Recurso creado correctamente.');
    return res.redirect(`/admin/recursos/${recurso._id}`);
  } catch (error) {
    next(error);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const payload         = await buildRecursoPayload(req);
    const recursoAnterior = await Recurso.findById(req.params.id);
    if (!recursoAnterior) {
      flash(req, 'error', 'El recurso no existe.');
      return res.redirect('/admin/recursos');
    }

    await Recurso.findByIdAndUpdate(req.params.id, payload, { runValidators: true });

    const nuevaCantidad      = payload.fisico?.total_ejemplares || 0;
    const ejemplaresActuales = await Ejemplar.countDocuments({ recurso_id: req.params.id });
    if (nuevaCantidad > ejemplaresActuales) {
      await crearEjemplaresParaRecurso(
        { ...recursoAnterior.toObject(), ...payload, _id: recursoAnterior._id },
        nuevaCantidad - ejemplaresActuales
      );
    }
    if (payload.fisico) {
      await sincronizarFisicoConEjemplares(req.params.id);
    }

    flash(req, 'success', 'Recurso actualizado correctamente.');
    return res.redirect(`/admin/recursos/${req.params.id}`);
  } catch (error) {
    next(error);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    await Promise.all([
      Recurso.findByIdAndDelete(req.params.id),
      Ejemplar.deleteMany({ recurso_id: req.params.id }),
    ]);
    flash(req, 'success', 'Recurso eliminado correctamente.');
    return res.redirect('/admin/recursos');
  } catch (error) {
    next(error);
  }
};

exports.buscarIsbn = async (req, res, next) => {
  try {
    const isbnService = require('../../services/isbnService');
    const data = await isbnService.buscarPorIsbn(req.params.isbn);
    res.json(data || {});
  } catch (error) {
    next(error);
  }
};

exports.subirArchivo = async (req, res, next) => {
  try {
    const archivoFile = req.files?.archivo?.[0] || req.file;
    if (!archivoFile) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }

    const titulo = String(req.body.titulo || 'recurso').trim();
    const subido  = await subirArchivoCloudinary(
      archivoFile.buffer,
      archivoFile.originalname,
      archivoFile.mimetype,
      titulo
    );

    return res.json(subido); // { url, public_id, tamano_bytes, ext }
  } catch (error) {
    next(error);
  }
};
