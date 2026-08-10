const validarUsuario = require('../../../middlewares/validarUsuario');
const { enviar } = require('../../helpers/validatorHarness');

describe('validarUsuario', () => {
  it('rechaza un correo inválido', async () => {
    const res = await enviar(validarUsuario, { correo: 'no-es-un-correo' });

    expect(res.status).toBe(400);
    expect(res.body.errores).toContain('correo');
  });

  it('rechaza un teléfono demasiado corto cuando se envía', async () => {
    const res = await enviar(validarUsuario, {
      correo: 'estudiante@institucion.edu.co',
      telefono: '123'
    });

    expect(res.status).toBe(400);
    expect(res.body.errores).toContain('telefono');
  });

  it('acepta correo válido sin teléfono (es opcional)', async () => {
    const res = await enviar(validarUsuario, {
      correo: 'estudiante@institucion.edu.co'
    });

    expect(res.status).toBe(200);
  });

  it('acepta correo y teléfono válidos', async () => {
    const res = await enviar(validarUsuario, {
      correo: 'estudiante@institucion.edu.co',
      telefono: '3001234567'
    });

    expect(res.status).toBe(200);
  });
});
