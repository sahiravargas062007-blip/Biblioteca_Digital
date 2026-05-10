const router = require('express').Router();
const controller = require('../../controllers/admin/ejemplarController');
const isAdminAuth = require('../../middlewares/isAdminAuth');

router.use(isAdminAuth);
router.put('/:id', controller.actualizar);
router.delete('/:id', controller.eliminar);

module.exports = router;
