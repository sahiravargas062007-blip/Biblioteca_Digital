const Sancion = require('../models/Sancion');
const Usuario = require('../models/Usuario');

exports.aplicar = async (payload) => {
  const sancion = await Sancion.create(payload);
  await Usuario.findByIdAndUpdate(payload.usuario, { estado: 'sancionado' });
  return sancion;
};

exports.levantar = async (sancionId, adminId) => {
  const sancion = await Sancion.findByIdAndUpdate(sancionId, {
    estado: 'levantada',
    levantadaPor: adminId,
    fechaLevantamiento: new Date()
  }, { new: true });
  return sancion;
};
