const router = require('express').Router();
const controller = require('../../controllers/user/reservaController');
const isUserAuth = require('../../middlewares/isUserAuth');

router.use(isUserAuth);
router.get('/', controller.index);
router.post('/', controller.crear);
router.post('/:id/cancelar', controller.cancelar);

module.exports = router;
