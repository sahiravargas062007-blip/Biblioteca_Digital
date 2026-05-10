const router = require('express').Router();
const controller = require('../../controllers/admin/reservaController');
const isAdminAuth = require('../../middlewares/isAdminAuth');

router.use(isAdminAuth);
router.get('/', controller.index);
router.get('/nueva', controller.nueva);
router.post('/', controller.crear);
router.post('/:id/cancelar', controller.cancelar);
router.post('/:id/liberar', controller.liberar);
router.post('/:id/procesar', controller.procesar);

module.exports = router;
