const router = require('express').Router();
const controller = require('../../controllers/user/authController');
const validarUsuario = require('../../middlewares/validarUsuario');

router.get('/login', controller.loginForm);
router.post('/login', validarUsuario, controller.login);
router.post('/logout', controller.logout);

router.get('/recuperar-password', controller.forgotPasswordForm);
router.post('/recuperar-password', controller.forgotPassword);
router.get('/reset-password/:token', controller.resetPasswordForm);
router.post('/reset-password/:token', controller.resetPassword);

module.exports = router;
