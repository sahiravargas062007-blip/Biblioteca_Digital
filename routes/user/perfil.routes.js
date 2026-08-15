const router = require('express').Router();
const controller = require('../../controllers/user/perfilController');
const isUserAuth = require('../../middlewares/isUserAuth');
const validarUsuario = require('../../middlewares/validarUsuario');

router.use(isUserAuth);
router.get('/', controller.index);
router.put('/', validarUsuario, controller.actualizar);
router.post('/password', validarUsuario, controller.cambiarPassword);

module.exports = router;
