const router  = require('express').Router();
const ctrl    = require('../../controllers/user/catalogoController');

router.get('/',                 ctrl.index);
router.get('/:id',              ctrl.detalle);
router.post('/:id/prestar',     ctrl.prestar);
router.get('/:id/ver',          ctrl.ver);
router.get('/:id/descargar',    ctrl.descargar);

module.exports = router;
