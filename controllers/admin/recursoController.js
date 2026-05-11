const mongoose = require('mongoose');
const AdmZip = require('adm-zip');
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
  const options      = { resource_type: resourceType, public_id: publicId };

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

    const [recursos, categorias] = await Promise.all([
      Recurso.find(filtro).sort({ creado_en: -1 }).lean(),
      Categoria.find({ activa: true }).sort({ nombre: 1 }).lean(),
    ]);

    res.render('admin/recursos/index', {
      title: 'Materiales', recursos, categorias,
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

exports.procesarMasivo = async (req, res, next) => {
  try {
    if (!req.file) {
      flash(req, 'error', 'Debe seleccionar un archivo ZIP.');
      return res.redirect('/admin/recursos/masivo');
    }

    const tipoContenido = req.body.tipo_contenido || 'Lectura';
    const allowed       = allowedMainExtensions(tipoContenido);
    const zip           = new AdmZip(req.file.buffer);
    const entries       = zip.getEntries().filter((e) => !e.isDirectory);
    const folders       = new Map();

    for (const entry of entries) {
      const parts = entry.entryName.split('/').filter(Boolean);
      if (parts.length < 2) continue;
      const folder = parts[0];
      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder).push(parts.slice(1).join('/'));
    }

    let creados = 0;
    const errores = [];

    for (const [folder, files] of folders.entries()) {
      const main = files.find((f) => allowed.includes(extension(f)));
      if (!main) {
        errores.push(`"${folder}" no contiene archivo principal válido para ${tipoContenido}.`);
        continue;
      }

      const mainExt = extension(main);

      await Recurso.create({
        tipo_naturaleza: 'Digital',
        tipo_contenido:  tipoContenido,
        tipo_material:   materialFromContenido(tipoContenido),
        titulo:          folder,
        autor:           'Pendiente de completar',
        descripcion:     'Recurso cargado masivamente. Pendiente de completar metadatos.',
        idioma:          '',
        imagen:          { url: '/img/placeholder.png', public_id: '', es_default: true },
        categorias:      [],
        estado:          'Pendiente de configuración',
        digital: {
          tipo_licencia: 'Libre',
          archivos: [{
            tipo:         tipoArchivoFromExt(mainExt),
            url:          `zip://${folder}/${main}`,
            public_id:    '',
            es_principal: true,
            tamano_bytes: 0,
            subido_en:    new Date(),
          }],
          licencias_en_uso:      0,
          estado_disponibilidad: 'Acceso libre',
        },
        fisico:          undefined,
        publicado:       false,
        total_prestamos: 0,
        total_reservas:  0,
        creado_en:       new Date(),
        actualizado_en:  new Date(),
      });

      creados += 1;
    }

    const detalleErrores = errores.length ? ` Errores: ${errores.join(' ')}` : '';
    flash(
      req,
      errores.length ? 'error' : 'success',
      `Carga procesada. Recursos creados: ${creados}.${detalleErrores}`
    );
    return res.redirect('/admin/recursos');
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

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT DE PROGRESO — SUBIDA ASÍNCRONA (AJAX)
// ─────────────────────────────────────────────────────────────────────────────
// El frontend puede llamar a POST /admin/recursos/subir-archivo
// y recibir { url, public_id, tamano_bytes, ext } sin bloquear el formulario.
// Esto permite mostrar una barra de progreso real mientras el archivo se sube.
//
// Ejemplo de uso en la vista (fetch + FormData):
//
//   const fd = new FormData();
//   fd.append('archivo', fileInput.files[0]);
//   fd.append('titulo', tituloInput.value);
//
//   const res = await fetch('/admin/recursos/subir-archivo', {
//     method: 'POST',
//     body: fd
//   });
//   const data = await res.json();
//   // data = { url, public_id, tamano_bytes, ext }
//   // Guardar url y public_id en campos hidden del formulario principal
//
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
