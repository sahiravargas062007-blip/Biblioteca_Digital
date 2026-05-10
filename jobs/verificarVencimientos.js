const cron = require('node-cron');
const prestamoService = require('../services/prestamoService');

module.exports = function verificarVencimientos() {
  cron.schedule('0 1 * * *', async () => {
    await prestamoService.actualizarEstadosVencidos();
  });
};
