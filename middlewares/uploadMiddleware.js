const multer = require('multer');

const storage = multer.memoryStorage();

// Prefijos MIME válidos por campo
// Para "archivo" aceptamos cualquier audio, video, pdf y epub
function fileFilter(req, file, cb) {
  const field = file.fieldname;
  const mime  = file.mimetype;

  if (field === 'imagen' || field === 'portada') {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(mime);
    return ok ? cb(null, true) : cb(new Error('La imagen debe ser JPG, PNG o WEBP.'));
  }

  if (field === 'archivo') {
    // Lectura: pdf, epub
    // Audio: cualquier audio/* (mp3, wav, m4b, ogg, aac...)
    // Video: cualquier video/* (mp4, webm, avi, mov...)
    const ok = mime === 'application/pdf'
      || mime === 'application/epub+zip'
      || mime.startsWith('audio/')
      || mime.startsWith('video/');
    return ok
      ? cb(null, true)
      : cb(new Error('Formato no permitido. Se aceptan PDF, ePub, archivos de audio y video.'));
  }

  if (field === 'zip') {
    const ok = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'].includes(mime);
    return ok ? cb(null, true) : cb(new Error('El archivo debe ser un ZIP.'));
  }

  if (field === 'excel') {
    const ok = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
      'text/csv'
    ].includes(mime);
    return ok ? cb(null, true) : cb(new Error('El archivo debe ser XLSX o CSV.'));
  }

  // Cualquier otro campo se acepta sin restricción
  cb(null, true);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB
});
