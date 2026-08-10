// Este archivo mantiene la misma interfaz pública que el antiguo
// controllers/admin/recursoController.js monolítico (1400+ líneas).
// routes/admin/recursos.routes.js sigue haciendo:
//   const controller = require('../../controllers/admin/recursoController');
//   controller.index, controller.crear, controller.masivo, etc.
// y no necesita ningún cambio.
//
// Organización de los sub-módulos:
//   helpers.js         → constantes, Cloudinary, normalización de texto
//   payload.js         → construcción del payload de un recurso (categorías,
//                         digital/físico, filtro de catálogo, ejemplares)
//   listado.js         → index, api, nuevo
//   crud.js             → detalle, editar, crear, actualizar, portada, eliminar
//   masivoZip.js         → carga masiva por ZIP (previsualizar/confirmar)
//   excelMetadatos.js    → HU-09: importación de metadatos desde Excel
//   metadatos.js         → búsqueda por ISBN/DOI + subida directa de archivo

module.exports = {
  ...require('./listado'),
  ...require('./crud'),
  ...require('./masivoZip'),
  ...require('./excelMetadatos'),
  ...require('./metadatos'),
};
