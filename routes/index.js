const router = require('express').Router();

router.get('/', (req, res) => res.redirect('/catalogo'));

// Admin layout middleware
router.use('/admin', (req, res, next) => {
  res.locals.layout = 'layouts/adminLayout';
  next();
});

router.use('/admin', require('./admin/auth.routes'));
router.use('/admin/recursos', require('./admin/recursos.routes'));
router.use('/admin/categorias', require('./admin/categorias.routes'));
router.use('/admin/ejemplares', require('./admin/ejemplares.routes'));
router.use('/admin/formatos', require('./admin/formatos.routes'));
router.use('/admin/usuarios', require('./admin/usuarios.routes'));
router.use('/admin/prestamos', require('./admin/prestamos.routes'));
router.use('/admin/devoluciones', require('./admin/devoluciones.routes'));
router.use('/admin/reservas', require('./admin/reservas.routes'));
router.use('/admin/sanciones', require('./admin/sanciones.routes'));
router.use('/admin/reportes', require('./admin/reportes.routes'));
router.use('/admin/configuracion', require('./admin/configuracion.routes'));

router.use('/', require('./user/auth.routes'));
router.use('/catalogo', require('./user/catalogo.routes'));
router.use('/prestamos', require('./user/prestamos.routes'));
router.use('/historial', require('./user/historial.routes'));
router.use('/reservas', require('./user/reservas.routes'));
router.use('/sanciones', require('./user/sanciones.routes'));
router.use('/perfil', require('./user/perfil.routes'));

module.exports = router;
