const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/catalogo', require('./catalogo.routes'));
router.use('/perfil', require('./perfil.routes'));
router.use('/prestamos', require('./prestamos.routes'));
router.use('/reservas', require('./reservas.routes'));
router.use('/historial', require('./historial.routes'));
router.use('/sanciones', require('./sanciones.routes'));
router.use('/anotaciones', require('./anotaciones.routes'));

module.exports = router;
