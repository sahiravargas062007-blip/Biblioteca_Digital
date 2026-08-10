const Sancion = require('../models/Sancion');
const Usuario = require('../models/Usuario');

exports.aplicar = async (payload) => {
  const sancion = await Sancion.create(payload);
  // El valor debe coincidir exactamente con el enum de Usuario.js
  // ('Activo' | 'Sancionado' | 'Suspendido' | ...); en minúscula no
  // machea el enum y otras partes del código que comparan por ese
  // string nunca detectarían al usuario como sancionado.
  await Usuario.findByIdAndUpdate(payload.usuario, { estado: 'Sancionado' });
  return sancion;
};

exports.levantar = async (sancionId, adminId) => {
  // Nombres de campo y valor de estado alineados con Sancion.js:
  // enum ['Activa', 'Levantada'] y columnas snake_case
  // (levantada_por, fecha_levantamiento). Antes se usaban nombres
  // camelCase inexistentes en el schema (se descartaban en
  // silencio por el modo strict) y 'levantada' en minúscula.
  const sancion = await Sancion.findByIdAndUpdate(sancionId, {
    estado: 'Levantada',
    levantada_por: adminId,
    fecha_levantamiento: new Date()
  }, { new: true, runValidators: true });
  return sancion;
};
