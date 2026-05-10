const Sancion = require('../../models/Sancion');

exports.index = async (req, res, next) => {
  try {
    const sanciones = await Sancion.find({
      usuario_id: req.session.userId
    }).sort({ creado_en: -1 }).lean();

    const now = new Date();
    const sancionsActivas = sanciones.filter(s => s.estado === 'Activa');
    const sancionsHistorico = sanciones.filter(s => s.estado === 'Levantada');

    const sancionesConDetalles = sanciones.map((sancion) => {
      const diasFaltantes = sancion.fecha_fin
        ? Math.ceil((new Date(sancion.fecha_fin) - now) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ...sancion,
        diasFaltantes: diasFaltantes && diasFaltantes > 0 ? diasFaltantes : null,
        estaVigente: sancion.estado === 'Activa' && (!sancion.fecha_fin || new Date(sancion.fecha_fin) > now)
      };
    });

    res.render('user/sanciones/index', {
      title: 'Mis sanciones',
      sanciones: sancionesConDetalles,
      sancionsActivas: sancionsActivas.length,
      sancionsHistorico: sancionsHistorico.length
    });
  } catch (error) {
    next(error);
  }
};
