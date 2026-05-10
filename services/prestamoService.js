const Sancion = require('../models/Sancion');
const ItemPrestamo = require('../models/ItemPrestamo');

exports.validarUsuarioHabilitado = async (usuarioId) => {
  const sancionActiva = await Sancion.exists({ usuario: usuarioId, estado: 'activa' });
  if (sancionActiva) throw new Error('El usuario tiene sanciones activas.');
  return true;
};

exports.actualizarEstadosVencidos = async () => {
  return ItemPrestamo.updateMany(
    { estado: 'activo', fechaLimite: { $lt: new Date() } },
    { estado: 'vencido' }
  );
};
