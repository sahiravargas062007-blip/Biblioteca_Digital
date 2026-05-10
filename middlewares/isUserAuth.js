module.exports = function isUserAuth(req, res, next) {
  if (req.session?.userId && req.session?.rol === 'usuario') return next();
  req.session.flash = { type: 'error', message: 'Debe iniciar sesion para continuar.' };
  return res.redirect('/login');
};
