const router = require('express').Router();
const controller = require('../../controllers/admin/categoriaController');
const isAdminAuth = require('../../middlewares/isAdminAuth');
const upload = require('../../middlewares/uploadMiddleware');

router.use(isAdminAuth);
router.get('/', controller.index);
router.get('/nueva', controller.formulario);
router.post('/', controller.crear);
router.post('/importar', upload.single('excel'), controller.importarExcel);
router.get('/:id/editar', controller.formulario);
router.put('/:id', controller.actualizar);
router.delete('/:id', controller.eliminar);

module.exports = router;
