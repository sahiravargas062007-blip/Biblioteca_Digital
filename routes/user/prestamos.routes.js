const router = require('express').Router();
const controller = require('../../controllers/user/prestamoController');
const isUserAuth = require('../../middlewares/isUserAuth');

router.use(isUserAuth);
router.get('/', controller.index);
router.get('/:id/acceder/:item_id', controller.acceder);
router.get('/:id/archivo/:item_id', controller.archivo);
router.get('/:id/descargar/:item_id', controller.descargarPrestamo);
router.post('/:id/devolver', controller.devolverDigital);

module.exports = router;
