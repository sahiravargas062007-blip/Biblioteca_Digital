const validarPrestamo = require('../../../middlewares/validarPrestamo');
const { enviar } = require('../../helpers/validatorHarness');

describe('validarPrestamo', () => {
  it('rechaza cuando usuario_id no es un ObjectId válido', async () => {
    const res = await enviar(validarPrestamo, {
      usuario_id: 'no-es-un-id',
      ejemplar_ids: ['a']
    });

    expect(res.status).toBe(400);
    expect(res.body.errores).toContain('usuario_id');
  });

  it('rechaza cuando no se selecciona ningún ejemplar', async () => {
    const res = await enviar(validarPrestamo, {
      usuario_id: '507f1f77bcf86cd799439011',
      ejemplar_ids: ''
    });

    expect(res.status).toBe(400);
    expect(res.body.errores).toContain('ejemplar_ids');
  });

  it('acepta un payload válido', async () => {
    const res = await enviar(validarPrestamo, {
      usuario_id: '507f1f77bcf86cd799439011',
      ejemplar_ids: ['507f1f77bcf86cd799439012']
    });

    expect(res.status).toBe(200);
  });
});
