const router = require('express').Router();
const controller = require('../../controllers/admin/recursoController');
const isAdminAuth = require('../../middlewares/isAdminAuth');
const validarRecurso = require('../../middlewares/validarRecurso');
const { uploadRecurso } = require('../../middlewares/uploadMiddleware');

router.use(isAdminAuth);

router.get('/',              controller.index);
router.get('/nuevo',         controller.nuevo);
router.get('/masivo',        controller.masivo);
router.get('/isbn/:isbn',    controller.buscarIsbn);

// ── Subida anticipada con barra de progreso (AJAX desde upload-progress.js)
router.post(
  '/subir-archivo',
  uploadRecurso.fields([{ name: 'archivo', maxCount: 1 }]),
  controller.subirArchivo
);

router.post('/',       uploadRecurso.fields([{ name: 'imagen' }, { name: 'archivo' }]), validarRecurso, controller.crear);
router.post('/masivo', uploadRecurso.single('zip'), controller.procesarMasivo);

router.get('/:id',        controller.detalle);
router.get('/:id/editar', controller.editar);
router.put('/:id',        uploadRecurso.fields([{ name: 'imagen' }, { name: 'archivo' }]), controller.actualizar);
router.delete('/:id',     controller.eliminar);

module.exports = router;