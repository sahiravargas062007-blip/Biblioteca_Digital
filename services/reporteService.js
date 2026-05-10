const Recurso = require('../models/Recurso');
const Prestamo = require('../models/Prestamo');
const Sancion = require('../models/Sancion');

exports.resumen = async () => {
  const [totalRecursos, prestamosActivos, usuariosSancionados] = await Promise.all([
    Recurso.countDocuments(),
    Prestamo.countDocuments({ estado: { $in: ['activo', 'parcialmente_devuelto', 'vencido'] } }),
    Sancion.distinct('usuario', { estado: 'activa' })
  ]);

  return {
    totalRecursos,
    prestamosActivos,
    usuariosSancionados: usuariosSancionados.length
  };
};
