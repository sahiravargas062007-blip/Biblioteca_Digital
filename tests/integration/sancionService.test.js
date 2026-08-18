const mongoose = require('mongoose');
const { conectar, limpiar, cerrarConexion } = require('../setup/db');
const Usuario = require('../../models/Usuario');
const Sancion = require('../../models/Sancion');
const sancionService = require('../../services/sancionService');

beforeAll(async () => {
  await conectar();
});

afterEach(async () => {
  await limpiar();
});

afterAll(async () => {
  await cerrarConexion();
});

async function crearUsuarioActivo() {
  return Usuario.create({
    ldap_uid: 'uid-001',
    nombre: 'Estudiante de prueba',
    documento: '1000000001',
    correo: 'estudiante@institucion.edu.co',
    estado: 'Activo'
  });
}

describe('sancionService.aplicar', () => {
  it('crea la sanción asociada al usuario', async () => {
    const usuario = await crearUsuarioActivo();

    const sancion = await sancionService.aplicar({
      usuario: usuario._id,
      usuario_id: usuario._id,
      usuario_nombre: usuario.nombre,
      usuario_documento: usuario.documento,
      tipo_incidencia: 'Retraso',
      gravedad: 'Leve',
      tipo_sancion: 'Advertencia'
    });

    expect(sancion._id).toBeDefined();
    const guardada = await Sancion.findById(sancion._id);
    expect(guardada.estado).toBe('Activa');
  });

  it('deja al usuario en el estado "Sancionado" definido por el enum del schema', async () => {
    // Regla de negocio central: un usuario con una sanción activa debe
    // quedar bloqueado con un valor que coincida EXACTO con el enum de
    // Usuario.js (['Activo','Sancionado','Suspendido', ...]), porque el
    // resto del código (middlewares de auth, reglas de préstamo/reserva)
    // compara ese string literal. findByIdAndUpdate no corre validadores
    // por defecto, así que un valor con casing distinto se guardaría
    // "silenciosamente" sin que nada avise del error.
    const usuario = await crearUsuarioActivo();

    await sancionService.aplicar({
      usuario: usuario._id,
      usuario_id: usuario._id,
      usuario_nombre: usuario.nombre,
      usuario_documento: usuario.documento,
      tipo_incidencia: 'Daño',
      gravedad: 'Grave',
      tipo_sancion: 'Suspensión'
    });

    const actualizado = await Usuario.findById(usuario._id);

    expect(actualizado.estado).toBe('Sancionado');
  });
});

describe('sancionService.levantar', () => {
  it('marca la sanción como Levantada y registra quién la levantó', async () => {
    const usuario = await crearUsuarioActivo();
    const admin = new mongoose.Types.ObjectId();

    const sancion = await sancionService.aplicar({
      usuario: usuario._id,
      usuario_id: usuario._id,
      usuario_nombre: usuario.nombre,
      usuario_documento: usuario.documento,
      tipo_incidencia: 'Retraso',
      gravedad: 'Leve',
      tipo_sancion: 'Advertencia'
    });

    const levantada = await sancionService.levantar(sancion._id, admin);

    // Nombres y valor alineados con el schema de Sancion.js
    // (enum ['Activa', 'Levantada'], campos snake_case).
    expect(levantada.estado).toBe('Levantada');
    expect(String(levantada.levantada_por)).toBe(String(admin));
    expect(levantada.fecha_levantamiento).toBeInstanceOf(Date);
  });
});
