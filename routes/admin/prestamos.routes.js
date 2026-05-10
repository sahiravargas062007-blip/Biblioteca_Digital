const router = require('express').Router();
const controller = require('../../controllers/admin/prestamoController');
const isAdminAuth = require('../../middlewares/isAdminAuth');
const validarPrestamo = require('../../middlewares/validarPrestamo');

router.use(isAdminAuth);
router.get('/', controller.index);
router.get('/historial', controller.historial);
router.get('/nuevo', controller.nuevo);
router.post('/', validarPrestamo, controller.crear);
router.get('/:id', controller.detalle);
router.post('/:id/renovar', controller.renovar);

module.exports = router;
