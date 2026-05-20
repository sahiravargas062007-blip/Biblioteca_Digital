const router  = require('express').Router();
const ctrl    = require('../../controllers/user/catalogoController');

router.get('/',                 ctrl.index);
router.get('/api',              ctrl.api);
router.get('/categorias',       ctrl.categorias);
router.get('/categorias/api/:id', ctrl.apiCategoriaRecursos);
router.get('/novedades',        ctrl.novedades);
router.get('/mas-leidos',       ctrl.masLeidos);
router.get('/:id',              ctrl.detalle);
router.post('/:id/prestar',     ctrl.prestar);
router.get('/:id/ver',          ctrl.ver);
router.get('/:id/descargar',    ctrl.descargar);

module.exports = router;
