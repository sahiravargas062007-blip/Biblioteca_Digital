const multer = require('multer');

const storage = multer.memoryStorage();

const allowedByField = {
  imagen: ['image/jpeg', 'image/png', 'image/webp'],
  portada: ['image/jpeg', 'image/png', 'image/webp'],
  archivo: ['application/pdf', 'application/epub+zip', 'audio/mpeg', 'video/mp4'],
  zip: ['application/zip', 'application/x-zip-compressed'],
  excel: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream'
  ]
};

function fileFilter(req, file, cb) {
  const allowed = allowedByField[file.fieldname];
  if (!allowed || allowed.includes(file.mimetype)) return cb(null, true);
  return cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
}

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }
});
