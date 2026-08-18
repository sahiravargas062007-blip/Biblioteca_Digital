const session = require('express-session');
const MongoStore = require('connect-mongo');

const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

const store = MongoStore.create({
  mongoUrl: process.env.MONGODB_URI,
  collectionName: 'sesiones'
});

const sessionConfig = session({
  secret: process.env.SESSION_SECRET || 'development_secret',
  resave: false,
  saveUninitialized: false,
  store,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_IDLE_TIMEOUT_MS
  }
});

// Permite a tests y apagados controlados liberar el cliente propio de
// connect-mongo; no pertenece a la conexión administrada por Mongoose.
sessionConfig.close = () => store.close();
sessionConfig.idleTimeoutMs = SESSION_IDLE_TIMEOUT_MS;

module.exports = sessionConfig;
