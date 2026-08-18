const { subirArchivoCloudinary } = require('./helpers');

exports.buscarIsbn = async (req, res, next) => {
  try {
    const isbnService = require('../../../services/isbnService');
    const data = await isbnService.buscarPorIsbn(req.params.isbn);
    res.json(data || {});
  } catch (error) {
    next(error);
  }
};

exports.buscarDoi = async (req, res, next) => {
  try {
    const doiService = require('../../../services/doiService');
    const doi = req.params[0]; // Capturar todo después de /doi/
    const data = await doiService.buscarPorDoi(doi);
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
