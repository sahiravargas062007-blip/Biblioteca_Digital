require('dotenv').config();

const connectDB = require('./config/db');
const registerJobs = require('./jobs');
const crearApp = require('./app');

const PORT = process.env.PORT || 3000;

async function main() {
  await connectDB();

  const app = crearApp();

  if (process.env.CRON_ENABLED === 'true') {
    registerJobs();
  }

  app.listen(PORT, () => {
    console.log(`Biblioteca digital running on ${process.env.APP_URL || `http://localhost:${PORT}`}`);
  });
}

main().catch((error) => {
  console.error('No fue posible iniciar el servidor:', error);
  process.exit(1);
});
