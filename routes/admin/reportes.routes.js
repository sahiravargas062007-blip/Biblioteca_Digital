const router = require('express').Router();
const controller = require('../../controllers/admin/reporteController');
const isAdminAuth = require('../../middlewares/isAdminAuth');

router.use(isAdminAuth);
router.get('/', controller.index);
router.get('/exportar/pdf', controller.exportarPdf);
router.get('/exportar/excel', controller.exportarExcel);

module.exports = router;
