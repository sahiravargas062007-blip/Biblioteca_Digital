const Prestamo = require('../../models/Prestamo');

exports.index = async (req, res, next) => {
  try {
    const prestamos = await Prestamo.find({
      usuario_id: req.session.userId,
      estado: { $in: ['Devuelto', 'Pendiente de reposición'] }
    }).sort({ actualizado_en: -1 }).lean();

    const prestamosConDetalles = prestamos.map((prestamo) => {
      const items = (prestamo.items || []).map((item) => ({
        ...item,
        diasUsados: item.fecha_devolucion_real && item.fecha_inicio
          ? Math.floor((new Date(item.fecha_devolucion_real) - new Date(item.fecha_inicio)) / (1000 * 60 * 60 * 24))
          : null
      }));

      return {
        ...prestamo,
        items,
        fecha_devolucion: items[0]?.fecha_devolucion_real || prestamo.actualizado_en
      };
    });

    res.render('user/historial/index', {
      title: 'Historial',
      prestamos: prestamosConDetalles
    });
  } catch (error) {
    next(error);
  }
};
