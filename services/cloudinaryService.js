const cloudinary = require('../config/cloudinary');

function ensureCloudinaryConfigured() {
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary no está configurado. Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en el archivo .env o en las variables de entorno.');
  }
}

exports.subirBuffer = (buffer, options = {}) => new Promise((resolve, reject) => {
  ensureCloudinaryConfigured();
  const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
    if (error) return reject(error);
    resolve(result);
  });
  stream.end(buffer);
});

exports.eliminar = (publicId, resourceType = 'image') => {
  if (!publicId) return null;
  ensureCloudinaryConfigured();
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};
