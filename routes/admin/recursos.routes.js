const router = require('express').Router();
const controller = require('../../controllers/admin/recursoController');
const isAdminAuth = require('../../middlewares/isAdminAuth');
const validarRecurso = require('../../middlewares/validarRecurso');
const { uploadRecurso, uploadZip, uploadExcel } = require('../../middlewares/uploadMiddleware');

router.use(isAdminAuth);

router.get('/',              controller.index);
router.get('/api',           controller.api);
router.get('/nuevo',         controller.nuevo);
router.get('/masivo',        controller.masivo);
router.get('/excel-metadatos', controller.excelMetadatos);
router.post('/excel-metadatos/procesar', uploadExcel.single('excel'), controller.procesarExcelMetadatos);
router.get('/isbn/:isbn',    controller.buscarIsbn);

// ── Subida anticipada con barra de progreso (AJAX desde upload-progress.js)
router.post(
  '/subir-archivo',
  uploadRecurso.fields([{ name: 'archivo', maxCount: 1 }]),
  controller.subirArchivo
);

// ── Carga individual
router.post('/', uploadRecurso.fields([{ name: 'imagen' }, { name: 'archivo' }]), validarRecurso, controller.crear);

// ── HU-08 PASO 1: el admin sube el ZIP → el sistema lo analiza y muestra vista previa (CA4)
router.post('/masivo/previsualizar', uploadZip.single('zip'), controller.previsualizarMasivo);

// ── HU-08 PASO 2: el admin confirma (CA5) o cancela (CA6)
router.post('/masivo/confirmar', controller.confirmarMasivo);

router.get('/:id',        controller.detalle);
router.get('/:id/editar', controller.editar);
router.put('/:id',        uploadRecurso.fields([{ name: 'imagen' }, { name: 'archivo' }]), controller.actualizar);
router.delete('/:id',     controller.eliminar);

module.exports = router;
