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

// ── Umbral para usar upload chunked (archivos > 90 MB van por chunks) ─────────
const UMBRAL_CHUNKED = 90 * 1024 * 1024;

// ── Tipos de archivo que necesitan chunked upload (videos generalmente) ────────
const VIDEO_EXTS = new Set(['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', 'wmv']);

// ── Extensiones válidas de imagen / portada ───────────────────────────────────
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

// ── Upload Preset de Cloudinary (RN5) ─────────────────────────────────────────
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || 'Biblioteca_name';

// ── Resource type correcto para Cloudinary según extensión ────────────────────
function cloudinaryResourceType(ext) {
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'm4b', 'm4a', 'ogg', 'aac', 'flac', 'wma'].includes(ext)) return 'video';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return 'raw';
}

// ── Extensión desde mimetype ──────────────────────────────────────────────────
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

// ── Genera public_id limpio para Cloudinary ───────────────────────────────────
function generarPublicId(titulo, carpeta) {
  const nombre = String(titulo || 'recurso')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase()
    .slice(0, 60);
  return `biblioteca/${carpeta}/${nombre}_${Date.now()}`;
}

// ── Sube archivo a Cloudinary (automáticamente elige normal o chunked) ─────────
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

  // Archivos de video grandes → chunked upload para evitar timeout
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

function prefixFromCategoria(categoriaNombre) {
  const normalized = normalizarTexto(categoriaNombre);
  return (normalized.slice(0, 3) || 'REC').padEnd(3, 'X');
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
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
  if (!['Digital', 'Mixto'].includes(body.tipo_naturaleza)) return undefined;

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
  if (!['Físico', 'Mixto'].includes(body.tipo_naturaleza)) return undefined;
  const total = Number(body.total_ejemplares || 0);
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

  // ── PORTADA ────────────────────────────────────────────────────────────────
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

  // ── ARCHIVO PRINCIPAL ──────────────────────────────────────────────────────
  let digitalPayload = buildDigital(req.body);

  const archivoFile = req.files?.archivo?.[0];
  if (archivoFile && ['Digital', 'Mixto'].includes(req.body.tipo_naturaleza)) {
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
    tipo_naturaleza:   req.body.tipo_naturaleza,
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

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

exports.index = async (req, res, next) => {
  try {
    const q             = String(req.query.q             || '').trim();
    const tipoContenido = String(req.query.tipo_contenido || '').trim();
    const categoriaId   = String(req.query.categoria_id  || '').trim();
    const estado        = String(req.query.estado         || '').trim();

    const filtro = {};
    if (q) {
      filtro.$or = [
        { titulo:                           new RegExp(q, 'i') },
        { autor:                            new RegExp(q, 'i') },
        { isbn:                             new RegExp(q, 'i') },
        { 'categorias.categoria_nombre':    new RegExp(q, 'i') },
        { 'categorias.subcategoria_nombre': new RegExp(q, 'i') },
      ];
    }
    if (tipoContenido) filtro.tipo_contenido = tipoContenido;
    if (estado)        filtro.estado         = estado;
    if (mongoose.isValidObjectId(categoriaId)) filtro['categorias.categoria_id'] = categoriaId;

    const [recursos, categorias, resumen] = await Promise.all([
      Recurso.find(filtro).sort({ creado_en: -1 }).lean(),
      Categoria.find({ activa: true }).sort({ nombre: 1 }).lean(),
      require('../../services/reporteService').resumen()
    ]);

    res.render('admin/recursos/index', {
      title: 'Materiales', recursos, categorias, resumen,
      filtros: { q, tipo_contenido: tipoContenido, categoria_id: categoriaId, estado },
    });
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

// ─────────────────────────────────────────────────────────────────────────────
// HU-09: Importación de metadatos desde Excel
// ─────────────────────────────────────────────────────────────────────────────
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

    // CA-03: Actualizar registros existentes
    for (const registro of filas) {
      try {
        // Buscar recurso por nombreArchivoOriginal en archivos digitales
        const recursoBuscado = await Recurso.findOne({
          'digital.archivos': {
            $elemMatch: { public_id: { $regex: registro.nombreArchivoOriginal, $options: 'i' } },
          },
        });

        if (!recursoBuscado) {
          errores.push(
            `No se encontró recurso para archivo: "${registro.nombreArchivoOriginal}"`
          );
          continue;
        }

        // RN-02: Validar campos obligatorios antes de cambiar estado
        const datosMerged = { ...recursoBuscado.toObject(), ...registro.datosProcesados };
        const tieneObligatorios = datosMerged.titulo && datosMerged.clasificacion;

        // Determinar nuevo estado
        let nuevoEstado = recursoBuscado.estado;
        if (req.body.auto_publicar === 'true' && tieneObligatorios) {
          nuevoEstado = 'Activo';
        }

        // CA-03: Actualizar con findOneAndUpdate
        const actualizado = await Recurso.findByIdAndUpdate(
          recursoBuscado._id,
          {
            ...registro.datosProcesados,
            estado: nuevoEstado,
            publicado: req.body.auto_publicar === 'true' && tieneObligatorios,
            actualizado_en: new Date(),
          },
          { new: true }
        );

        if (actualizado) {
          exitosos += 1;
          if (actualizado.publicado) publicados += 1;

          detalles.push({
            nombreArchivo: registro.nombreArchivoOriginal,
            titulo: actualizado.titulo || 'Sin título',
            publicado: actualizado.publicado,
          });
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

    // CA-04: Reporte de resultados
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS PARA CARGA MASIVA (HU-08)
// ─────────────────────────────────────────────────────────────────────────────

function extension(filename) {
  return filename.split('.').pop().toLowerCase();
}

function tipoArchivoFromExt(ext) {
  const audioExts = ['mp3', 'wav', 'm4b', 'm4a', 'ogg', 'aac', 'flac'];
  const videoExts = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
  if (audioExts.includes(ext)) return ext;
  if (videoExts.includes(ext)) return ext;
  if (ext === 'pdf')  return 'pdf';
  if (ext === 'epub') return 'epub';
  return ext;
}

function materialFromContenido(tipoContenido) {
  if (tipoContenido === 'Audio') return 'Audiolibro';
  if (tipoContenido === 'Video') return 'Video';
  return 'Libro';
}

function allowedMainExtensions(tipoContenido) {
  if (tipoContenido === 'Audio') return ['mp3', 'wav', 'm4b', 'm4a', 'ogg', 'aac', 'flac', 'wma'];
  if (tipoContenido === 'Video') return ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv'];
  return ['pdf', 'epub'];
}

// ── Normaliza el nombre base (sin extensión) para asociar archivos planos ─────
function nombreBase(filename) {
  const partes = filename.split('.');
  if (partes.length > 1) partes.pop();
  return partes.join('.').toLowerCase();
}

/**
 * Si el ZIP tiene un folder raíz único que envuelve todo, lo quitamos.
 * Ejemplo: Ejemplo/Libro1/archivo.pdf -> Libro1/archivo.pdf
 */
function stripCommonRoot(entries) {
  const paths = entries.map((e) => e.entryName.split('/').filter(Boolean));
  if (paths.length === 0) return entries.map((entry) => ({ entry, normalizedEntryName: entry.entryName }));

  const root = paths[0][0];
  const commonRoot = paths.every((parts) => parts[0] === root);
  const hasDeepEntry = paths.some((parts) => parts.length > 1);

  if (!commonRoot || !hasDeepEntry) {
    return entries.map((entry) => ({ entry, normalizedEntryName: entry.entryName }));
  }

  return entries.map((entry) => {
    const parts = entry.entryName.split('/').filter(Boolean);
    return {
      entry,
      normalizedEntryName: parts.slice(1).join('/'),
    };
  });
}

/**
 * CA1 + CA2: Analiza las entradas del ZIP y devuelve recursos detectados.
 * - Estructura plana  → asociación por nombre base compartido.
 * - Estructura carpetas → cada carpeta = 1 recurso.
 */
function analizarZip(zip, tipoContenido) {
  const allowedMain = allowedMainExtensions(tipoContenido);
  const allEntries = zip.getEntries().filter((e) => e.entryName && e.entryName !== '');
  const entries = stripCommonRoot(allEntries);
  const fileEntries = entries.filter(({ entry }) => !entry.isDirectory && !entry.entryName.endsWith('/'));

  // ¿Hay entradas dentro de subcarpetas? → estructura por carpetas
  const haySubcarpetas = entries.some(({ normalizedEntryName }) => {
    const parts = normalizedEntryName.split('/').filter(Boolean);
    return parts.length >= 2;
  });

  const recursos = [];
  const errores  = [];

  if (haySubcarpetas) {
    // ── CA2: Estructura por carpetas ─────────────────────────────────────────
    const folderNames = new Set();

    for (const { normalizedEntryName } of entries) {
      const parts = normalizedEntryName.split('/').filter(Boolean);
      if (parts.length >= 2) folderNames.add(parts[0]);
    }

    for (const folder of folderNames) {
      const folderEntries = fileEntries.filter(({ normalizedEntryName }) => {
        const parts = normalizedEntryName.split('/').filter(Boolean);
        return parts[0] === folder;
      }).map(({ entry }) => entry);

      const mainEntry        = folderEntries.find((e) => allowedMain.includes(extension(e.name)));
      const portadaEntry     = folderEntries.find((e) => IMAGE_EXTS.has(extension(e.name)));
      const complementoEntry = tipoContenido === 'Lectura'
        ? folderEntries.find((e) => ['mp3', 'wav', 'm4a'].includes(extension(e.name)) && e !== mainEntry)
        : null;

      if (!mainEntry) {
        errores.push(`Carpeta "${folder}" no tiene archivo principal válido para "${tipoContenido}".`);
        recursos.push({ titulo: folder, tieneMain: false, tienePortada: !!portadaEntry });
        continue;
      }

      recursos.push({
        titulo:           folder,
        tieneMain:        true,
        tienePortada:     !!portadaEntry,
        mainEntry,
        portadaEntry:     portadaEntry     || null,
        complementoEntry: complementoEntry || null,
      });
    }
  } else {
    // ── CA1: Estructura plana — asociación por nombre base ───────────────────
    // Solo procesar archivos que tengan extensión
    const entriesConExtension = entries.filter(({ entry }) => entry.name.includes('.'));

    const grupos = new Map();

    for (const { entry } of entriesConExtension) {
      const ext  = extension(entry.name);
      const base = nombreBase(entry.name);

      if (!grupos.has(base)) grupos.set(base, { main: null, portada: null, complemento: null });
      const grupo = grupos.get(base);

      if (allowedMain.includes(ext))                                               grupo.main = entry;
      else if (IMAGE_EXTS.has(ext))                                                grupo.portada = entry;
      else if (tipoContenido === 'Lectura' && ['mp3','wav','m4a'].includes(ext))   grupo.complemento = entry;
    }

    for (const [base, grupo] of grupos.entries()) {
      if (!grupo.main && !grupo.portada && !grupo.complemento) continue;

      if (!grupo.main) {
        errores.push(`Archivo "${base}" no tiene archivo principal válido para "${tipoContenido}".`);
        recursos.push({ titulo: base, tieneMain: false, tienePortada: !!grupo.portada });
        continue;
      }

      recursos.push({
        titulo:           base.replace(/_/g, ' ').replace(/-/g, ' '),
        tieneMain:        true,
        tienePortada:     !!grupo.portada,
        mainEntry:        grupo.main,
        portadaEntry:     grupo.portada     || null,
        complementoEntry: grupo.complemento || null,
      });
    }
  }

  return { recursos, errores };
}

// ─────────────────────────────────────────────────────────────────────────────
// PASO 1 — POST /admin/recursos/masivo/previsualizar
// CA4: analizar el ZIP y mostrar previsualización sin guardar nada
// ─────────────────────────────────────────────────────────────────────────────
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
      title:         'Carga masiva — Vista previa',
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

// ─────────────────────────────────────────────────────────────────────────────
// PASO 2 — POST /admin/recursos/masivo/confirmar
// CA5: subir a Cloudinary y guardar en MongoDB
// CA6: si cancela, no guarda nada
// ─────────────────────────────────────────────────────────────────────────────
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

    // Permitir guardar todos los recursos (con o sin archivo digital)
    const recursosAGuardar = recursos;

    if (recursosAGuardar.length === 0) {
      flash(req, 'error', 'No se detectaron carpetas en el ZIP.');
      return res.redirect('/admin/recursos/masivo');
    }

    let creados = 0;
    const erroresSubida = [];

    for (const recurso of recursosAGuardar) {
      try {
        const archivos = [];

        // ── Subir archivo principal a Cloudinary solo si existe (RN5) ────────
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

        // ── Complemento de audio (solo Lectura y si hay main) ───────────────
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

        // ── Portada: subir a Cloudinary o usar placeholder (CA3) ─────────────
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

        // ── RN4: guardar en MongoDB con estado "Pendiente de configuración" ──
        await Recurso.create({
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
      `Carga completada. Recursos creados: ${creados}.${detalleErrores}`
    );
    return res.redirect('/admin/recursos');
  } catch (error) {
    next(error);
  } finally {
    if (zipTempPath) await fs.unlink(zipTempPath).catch(() => {});
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESTO DE CONTROLLERS — idénticos a tu versión original
// ─────────────────────────────────────────────────────────────────────────────

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