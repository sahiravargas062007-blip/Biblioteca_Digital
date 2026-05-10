const verificarVencimientos = require('./verificarVencimientos');
const verificarReservas = require('./verificarReservas');
const enviarRecordatorios = require('./enviarRecordatorios');

module.exports = function registerJobs() {
  verificarVencimientos();
  verificarReservas();
  enviarRecordatorios();
};
