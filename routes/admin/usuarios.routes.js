const router = require('express').Router();
const controller = require('../../controllers/admin/usuarioController');
const isAdminAuth = require('../../middlewares/isAdminAuth');

router.use(isAdminAuth);
router.get('/', controller.index);
router.post('/:id/aprobar', controller.aprobar);
router.post('/:id/rechazar', controller.rechazar);
router.post('/:id/suspender', controller.suspender);
router.post('/:id/restablecer', controller.restablecer);

module.exports = router;
