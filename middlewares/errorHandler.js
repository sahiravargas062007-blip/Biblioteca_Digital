module.exports = function errorHandler(error, req, res, next) {
  console.error(error);

  if (res.headersSent) return next(error);

  res.status(error.status || 500).render('error', {
    title: 'Error',
    message: error.message || 'Ocurrio un error interno.'
  });
};
