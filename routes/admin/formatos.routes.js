const router = require('express').Router();
const controller = require('../../controllers/admin/formatoController');
const isAdminAuth = require('../../middlewares/isAdminAuth');
const upload = require('../../middlewares/uploadMiddleware');

router.use(isAdminAuth);
router.put('/:id', upload.single('archivo'), controller.actualizar);
router.delete('/:id', controller.eliminar);

module.exports = router;
