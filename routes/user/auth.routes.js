const router = require('express').Router();
const controller = require('../../controllers/user/authController');
const validarUsuario = require('../../middlewares/validarUsuario');
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Aumentado para evitar bloqueos
  message: 'Demasiados intentos desde esta IP, por favor intenta de nuevo después de 15 minutos.'
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50, // Aumentado
  message: 'Demasiadas cuentas creadas desde esta IP, intenta más tarde.'
});

// Registro
router.get('/registro', controller.registerForm);
router.post('/registro', registerLimiter, validarUsuario, controller.register);

// Verificación
router.get('/verificar-correo', controller.verifyEmailForm);
router.post('/verificar-correo', controller.verifyEmail);
router.post('/reenviar-codigo', controller.resendVerificationCode);

// Login
router.get('/login', controller.loginForm);
router.post('/login', authLimiter, validarUsuario, controller.login);
router.post('/logout', controller.logout);

// Recuperación
router.get('/recuperar-password', controller.forgotPasswordForm);
router.post('/recuperar-password', authLimiter, controller.forgotPassword);
router.get('/recuperar-password/verificar', controller.verifyResetCodeForm);
router.post('/recuperar-password/verificar', authLimiter, controller.verifyResetCode);
router.get('/recuperar-password/nueva', controller.resetPasswordForm);
router.post('/recuperar-password/nueva', controller.resetPassword);

// Google OAuth
const passport = require('passport');
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login', session: false }), controller.googleCallback);

module.exports = router;
