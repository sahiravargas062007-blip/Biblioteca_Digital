const router = require('express').Router();
const controller = require('../../controllers/admin/configuracionController');
const isAdminAuth = require('../../middlewares/isAdminAuth');

router.use(isAdminAuth);
router.get('/', controller.index);
router.put('/', controller.actualizar);

module.exports = router;
