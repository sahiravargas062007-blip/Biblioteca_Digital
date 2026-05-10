exports.index = (req, res) => res.render('admin/reportes/index', { title: 'Reportes' });
exports.exportarPdf = (req, res) => res.status(501).send('Exportacion PDF pendiente de implementar.');
exports.exportarExcel = (req, res) => res.status(501).send('Exportacion Excel pendiente de implementar.');
