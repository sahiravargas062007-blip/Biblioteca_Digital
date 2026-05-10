const router = require('express').Router();
const controller = require('../../controllers/user/authController');
const validarUsuario = require('../../middlewares/validarUsuario');

router.get('/login', controller.loginForm);
router.post('/login', validarUsuario, controller.login);
router.post('/logout', controller.logout);

module.exports = router;
