const router = require('express').Router();
const controller = require('../../controllers/admin/recursoController');
const isAdminAuth = require('../../middlewares/isAdminAuth');
const validarRecurso = require('../../middlewares/validarRecurso');
const upload = require('../../middlewares/uploadMiddleware');

router.use(isAdminAuth);
router.get('/', controller.index);
router.get('/nuevo', controller.nuevo);
router.get('/masivo', controller.masivo);
router.get('/isbn/:isbn', controller.buscarIsbn);
router.post('/', upload.fields([{ name: 'imagen' }, { name: 'archivo' }]), validarRecurso, controller.crear);
router.post('/masivo', upload.single('zip'), controller.procesarMasivo);
router.get('/:id', controller.detalle);
router.get('/:id/editar', controller.editar);
router.put('/:id', upload.fields([{ name: 'imagen' }, { name: 'archivo' }]), controller.actualizar);
router.delete('/:id', controller.eliminar);

module.exports = router;
