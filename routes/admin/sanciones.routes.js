const router = require('express').Router();
const controller = require('../../controllers/admin/sancionController');
const isAdminAuth = require('../../middlewares/isAdminAuth');

router.use(isAdminAuth);
router.get('/', controller.index);
router.get('/historial', controller.historial);
router.get('/sugerir', controller.sugerir);
router.post('/', controller.crear);
router.post('/:id/levantar', controller.levantar);

module.exports = router;
