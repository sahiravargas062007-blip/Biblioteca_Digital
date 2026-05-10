module.exports = function isAdminAuth(req, res, next) {
  if (req.session?.adminId && req.session?.rol === 'administrador') return next();
  req.session.flash = { type: 'error', message: 'Debe iniciar sesion como administrador.' };
  return res.redirect('/admin/login');
};
