const { esAjax } = require('../utils/responder');

module.exports = function errorHandler(error, req, res, next) {
  console.error(error);

  if (res.headersSent) return next(error);

  const status = error.status || 500;

  if (esAjax(req)) {
    return res.status(status).json({
      success: false,
      message: error.message || 'Ocurrio un error interno.'
    });
  }

  res.status(status).render('error', {
    title: 'Error',
    message: error.message || 'Ocurrio un error interno.'
  });
};
