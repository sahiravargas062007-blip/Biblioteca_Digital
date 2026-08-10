const bcrypt = require('bcryptjs');
const request = require('supertest');
const { conectar, limpiar, cerrarConexion } = require('../setup/db');

let app;
let Usuario;
let Administrador;

beforeAll(async () => {
  // MONGODB_URI debe existir ANTES de requerir la app, porque
  // config/session.js crea el MongoStore (connect-mongo) al cargarse.
  await conectar();

  // Requires diferidos a después de conectar(), por la misma razón.
  app = require('../../app')();
  Usuario = require('../../models/Usuario');
  Administrador = require('../../models/Administrador');
});

afterEach(async () => {
  await limpiar();
});

afterAll(async () => {
  await cerrarConexion();
});

describe('POST /login', () => {
  it('inicia sesión como administrador con credenciales correctas', async () => {
    const password_hash = await bcrypt.hash('admin1234', 10);
    await Administrador.create({
      nombre: 'Admin de prueba',
      correo: 'admin@institucion.edu.co',
      password_hash,
      activo: true
    });

    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ correo: 'admin@institucion.edu.co', password: 'admin1234' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/recursos');
  });

  it('rechaza al usuario con contraseña incorrecta', async () => {
    const password_hash = await bcrypt.hash('claveCorrecta', 10);
    await Usuario.create({
      ldap_uid: 'uid-100',
      nombre: 'Usuario de prueba',
      documento: '1000000100',
      correo: 'usuario@institucion.edu.co',
      password_hash,
      estado: 'Activo'
    });

    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ correo: 'usuario@institucion.edu.co', password: 'claveIncorrecta' });

    // No hay LDAP configurado en el entorno de test, así que cae al
    // flujo de credenciales inválidas y vuelve al login (no al catálogo).
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('bloquea a un usuario cuyo estado no es Activo', async () => {
    const password_hash = await bcrypt.hash('claveCorrecta', 10);
    await Usuario.create({
      ldap_uid: 'uid-101',
      nombre: 'Usuario suspendido',
      documento: '1000000101',
      correo: 'suspendido@institucion.edu.co',
      password_hash,
      estado: 'Suspendido'
    });

    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ correo: 'suspendido@institucion.edu.co', password: 'claveCorrecta' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});
