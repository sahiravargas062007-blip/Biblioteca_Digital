const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

function ensureCloudinaryConfigured() {
  if (
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error(
      'Cloudinary no está configurado. Configure CLOUDINARY_CLOUD_NAME, ' +
      'CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en el archivo .env.'
    );
  }
}

// ── Subida normal (imágenes, PDFs, audios pequeños < 100 MB) ─────────────────
exports.subirBuffer = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    ensureCloudinaryConfigured();
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    Readable.from(buffer).pipe(stream);
  });

// ── Subida por chunks para archivos grandes (videos, audios > 100 MB) ────────
// Cloudinary permite hasta 2 GB usando upload_large / upload_chunked.
// Chunk size recomendado: 20 MB (valor mínimo soportado por la API).
const CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB

exports.subirBufferGrande = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    ensureCloudinaryConfigured();

    // Cloudinary necesita un ReadableStream para upload_large
    const readable = Readable.from(buffer);

    cloudinary.uploader.upload_chunked_stream(
      readable,
      {
        ...options,
        chunk_size: CHUNK_SIZE,
        timeout: 120000, // 2 minutos por chunk (no por la subida total)
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
  });

exports.eliminar = (publicId, resourceType = 'image') => {
  if (!publicId) return null;
  ensureCloudinaryConfigured();
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};
