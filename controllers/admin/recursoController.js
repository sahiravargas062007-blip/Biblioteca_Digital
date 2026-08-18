// Este controlador se dividió en módulos más pequeños dentro de ./recurso/
// por responsabilidad (listado, CRUD, carga masiva, Excel, metadatos
// externos). Ver controllers/admin/recurso/index.js para el detalle.
// Este archivo existe solo para no romper el require() que usan las rutas:
//   require('../../controllers/admin/recursoController')
module.exports = require('./recurso');
