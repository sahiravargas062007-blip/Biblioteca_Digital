const { idleTimeoutMs } = require('../config/session');

/** Renueva la sesión únicamente mientras exista actividad autenticada. */
module.exports = function sessionInactivity(req, res, next) {
  const isAuthenticated = req.session?.userId || req.session?.adminId;
  if (!isAuthenticated) return next();

  const now = Date.now();
  const lastActivityAt = Number(req.session.lastActivityAt || now);

  if (now - lastActivityAt >= idleTimeoutMs) {
    return req.session.destroy(() => {
      if (req.path === '/sesion/actividad') {
        return res.status(401).json({ expired: true });
      }
      return res.redirect('/login?expirada=1');
    });
  }

  req.session.lastActivityAt = now;
  return next();
};
