const validarRecurso = require('../../../middlewares/validarRecurso');
const { enviar } = require('../../helpers/validatorHarness');

const payloadValido = {
  titulo: 'Cien años de soledad',
  autor: 'Gabriel García Márquez',
  descripcion: 'Novela emblemática del realismo mágico.',
  tipo_contenido: 'Lectura',
  tipo_naturaleza: 'Físico',
  tipo_material: 'Libro'
};

describe('validarRecurso', () => {
  it('acepta un payload completo y válido', async () => {
    const res = await enviar(validarRecurso, payloadValido);
    expect(res.status).toBe(200);
  });

  it('rechaza cuando falta el título', async () => {
    const { titulo, ...resto } = payloadValido;
    const res = await enviar(validarRecurso, resto);

    expect(res.status).toBe(400);
    expect(res.body.errores).toContain('titulo');
  });

  it('rechaza un tipo_contenido fuera del catálogo permitido', async () => {
    const res = await enviar(validarRecurso, {
      ...payloadValido,
      tipo_contenido: 'Comic'
    });

    expect(res.status).toBe(400);
    expect(res.body.errores).toContain('tipo_contenido');
  });

  it('rechaza un tipo_naturaleza fuera del catálogo permitido', async () => {
    const res = await enviar(validarRecurso, {
      ...payloadValido,
      tipo_naturaleza: 'Holograma'
    });

    expect(res.status).toBe(400);
    expect(res.body.errores).toContain('tipo_naturaleza');
  });
});
