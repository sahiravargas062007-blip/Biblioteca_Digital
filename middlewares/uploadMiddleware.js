const multer = require('multer');

// ── Almacenamiento en memoria ─────────────────────────────────────────────────
// Los archivos se acumulan en req.files para luego subirse a Cloudinary.
// El límite alto (2 GB) solo aplica al campo "archivo"; imágenes y excel
// tienen sus propios limitadores más estrictos (ver configuraciones abajo).
const storage = multer.memoryStorage();

// ── Filtro de tipos MIME por campo ────────────────────────────────────────────
function fileFilter(req, file, cb) {
  const field = file.fieldname;
  const mime  = file.mimetype;

  if (field === 'imagen' || field === 'portada') {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(mime);
    return ok
      ? cb(null, true)
      : cb(new Error('La imagen debe ser JPG, PNG o WEBP.'));
  }

  if (field === 'archivo') {
    const ok =
      mime === 'application/pdf' ||
      mime === 'application/epub+zip' ||
      mime.startsWith('audio/') ||
      mime.startsWith('video/') ||
      mime.startsWith('image/');
    return ok
      ? cb(null, true)
      : cb(new Error('Formato no permitido. Se aceptan PDF, ePub, audio, video e imágenes.'));
  }

  if (field === 'zip') {
    const ok = [
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',
    ].includes(mime);
    return ok ? cb(null, true) : cb(new Error('El archivo debe ser un ZIP.'));
  }

  if (field === 'excel') {
    const ok = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
      'text/csv',
    ].includes(mime);
    return ok ? cb(null, true) : cb(new Error('El archivo debe ser XLSX o CSV.'));
  }

  cb(null, true);
}

// ── Configuraciones de multer con límites diferenciados ───────────────────────

// Para formularios con imagen + archivo principal (puede ser video grande)
const uploadRecurso = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2 GB — Cloudinary soporta hasta 2 GB via chunked upload
    files: 5,
  },
});

// Para imágenes solas (portadas, thumbnails)
const uploadImagen = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
  },
});

// Para carga masiva por ZIP
const uploadZip = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB
    files: 1,
  },
});

// Para importación masiva por Excel
const uploadExcel = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
  },
});

// ── Compatibilidad hacia atrás ────────────────────────────────────────────────
// Las rutas que usaban `upload` directamente siguen funcionando
module.exports = uploadRecurso;
module.exports.uploadRecurso = uploadRecurso;
module.exports.uploadImagen  = uploadImagen;
module.exports.uploadZip     = uploadZip;
module.exports.uploadExcel   = uploadExcel;
