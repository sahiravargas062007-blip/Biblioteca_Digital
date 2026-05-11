const router     = require('express').Router();
const controller = require('../../controllers/admin/reporteController');
const isAdminAuth = require('../../middlewares/isAdminAuth');

router.use(isAdminAuth);

router.get('/',                  controller.index);
router.get('/data/materiales',   controller.dataMateriales);
router.get('/data/prestamos',    controller.dataPrestamos);
router.get('/data/morosos',      controller.dataMorosos);
router.get('/exportar/pdf',      controller.exportarPdf);
router.get('/exportar/excel',    controller.exportarExcel);

module.exports = router;
