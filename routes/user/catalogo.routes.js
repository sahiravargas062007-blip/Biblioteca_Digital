const router = require('express').Router();
const controller = require('../../controllers/user/catalogoController');

router.get('/', controller.index);
router.get('/:id/ver', controller.ver);
router.get('/:id/archivo', controller.archivo);
router.get('/:id/descargar', controller.descargar);
router.get('/:id', controller.detalle);

module.exports = router;
