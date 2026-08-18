const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const methodOverride = require("method-override");
const expressLayouts = require("express-ejs-layouts");

const sessionConfig = require("./config/session");
const sessionInactivity = require("./middlewares/sessionInactivity");
const routes = require("./routes");
const errorHandler = require("./middlewares/errorHandler");

/**
 * Construye y configura la app de Express, sin conectar a la base de
 * datos ni levantar el servidor HTTP. Separar esto de server.js permite:
 *  - Testear rutas con supertest sin abrir un puerto real.
 *  - Reusar la misma configuración de app en distintos entornos
 *    (tests, producción, scripts) sin duplicar código.
 */
function crearApp() {
  const app = express();
  app.set("trust proxy", 1); // Confía en el proxy inverso (ej. Nginx, Render, Heroku) para detectar IPs reales
  
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(expressLayouts);
  app.set("layout", "layouts/userLayout"); // Layout por defecto
  app.set("layout extractScripts", true);
  app.set("layout extractStyles", true);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 3000 }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(methodOverride("_method"));
  app.use(sessionConfig);
  app.use(sessionInactivity);
  app.use(require("passport").initialize());
  app.use(express.static(path.join(__dirname, "public")));

  app.use((req, res, next) => {
    res.locals.session = req.session;
    res.locals.flash = req.session.flash || null;
    res.locals.currentPath = req.path;
    delete req.session.flash;
    next();
  });

  // ── Timeout extendido para subida de archivos grandes (videos) ──────────
  app.use("/admin/recursos", (req, res, next) => {
    if (req.method === "POST") {
      res.setTimeout(10 * 60 * 1000); // 10 minutos
    }
    next();
  });

  app.use(routes);
  app.use(errorHandler);

  return app;
}

module.exports = crearApp;
