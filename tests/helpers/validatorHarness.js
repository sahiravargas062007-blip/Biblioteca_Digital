const express = require('express');
const request = require('supertest');
const { validationResult } = require('express-validator');

/**
 * Monta una cadena de validadores de express-validator (un middleware
 * array como los de middlewares/validar*.js) en una ruta POST de prueba,
 * y expone los errores de validación como JSON.
 *
 * Esto nos deja testear los validadores tal como se comportan en
 * producción (son "ValidationChain" de express-validator, no funciones
 * puras), sin tener que levantar la app completa.
 */
function crearAppDeValidacion(validador) {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  app.post('/test', validador, (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({ errores: errores.array().map((e) => e.path) });
    }
    return res.status(200).json({ ok: true });
  });

  return app;
}

function enviar(validador, body) {
  const app = crearAppDeValidacion(validador);
  return request(app).post('/test').send(body);
}

module.exports = { enviar };
