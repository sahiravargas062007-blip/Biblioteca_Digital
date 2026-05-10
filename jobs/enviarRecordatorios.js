const cron = require('node-cron');

module.exports = function enviarRecordatorios() {
  cron.schedule('30 7 * * *', async () => {
    // Pendiente: consultar prestamos que vencen en 24 horas y enviar correo.
  });
};
