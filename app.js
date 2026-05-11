require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const methodOverride = require('method-override');

const connectDB = require('./config/db');
const sessionConfig = require('./config/session');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const registerJobs = require('./jobs');

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(sessionConfig);
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.flash = req.session.flash || null;
  res.locals.currentPath = req.path;
  delete req.session.flash;
  next();
});

// ── Timeout extendido para subida de archivos grandes (videos) ────────────
app.use('/admin/recursos', (req, res, next) => {
  if (req.method === 'POST') {
    res.setTimeout(10 * 60 * 1000); // 10 minutos
  }
  next();
});

app.use(routes);
app.use(errorHandler);

if (process.env.CRON_ENABLED === 'true') {
  registerJobs();
}

app.listen(PORT, () => {
  console.log(`Biblioteca digital running on ${process.env.APP_URL || `http://localhost:${PORT}`}`);
});

module.exports = app;