/**
 * Detecta si la petición viene de nuestro fetch() del admin (ver
 * public/js/admin/ajax-page.js), que siempre manda este header.
 * Si no está presente, es una navegación normal del navegador.
 */
function esAjax(req) {
  return req.get('X-Requested-With') === 'fetch';
}

/**
 * Flash de sesión, igual que ya se usaba en cada controlador
 * (se deja aquí centralizado para no repetirlo en cada archivo).
 */
function flash(req, type, message) {
  req.session.flash = { type, message };
}

/**
 * Responde una acción exitosa (aprobar, suspender, cancelar, etc.):
 * - Petición normal -> flash + redirect (comportamiento de siempre).
 * - Petición ajax    -> JSON { success: true, message, ...extra }.
 *
 * `extra.redirectTo`, si viene, le indica al cliente que navegue
 * de página completa (por ejemplo: procesar una reserva termina
 * en la ficha del préstamo generado, no en la misma lista).
 */
function ok(req, res, { redirect, message, extra = {} }) {
  if (esAjax(req)) {
    return res.json(Object.assign({ success: true, message }, extra));
  }
  flash(req, 'success', message);
  return res.redirect(redirect);
}

/**
 * Igual que ok(), pero para errores/validaciones fallidas.
 */
function fail(req, res, { redirect, message, status = 400, extra = {} }) {
  if (esAjax(req)) {
    return res.status(status).json(Object.assign({ success: false, message }, extra));
  }
  flash(req, 'error', message);
  return res.redirect(redirect);
}

module.exports = { esAjax, flash, ok, fail };
