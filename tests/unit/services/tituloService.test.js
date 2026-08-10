const {
  sonTitulosSimilares,
  mejorCoincidencia,
} = require('../../../services/tituloService');

describe('sonTitulosSimilares — casos reales reportados', () => {
  it('"El Alquimista" ~= "El alquimista - paulo Coelho"', () => {
    expect(sonTitulosSimilares('El Alquimista', 'El alquimista - paulo Coelho')).toBe(true);
  });

  it('"Becoming" ~= "Becoming de Michelle Obama"', () => {
    expect(sonTitulosSimilares('Becoming', 'Becoming de Michelle Obama')).toBe(true);
  });

  it('"homo-deus" ~= "Homo Deus (Yuval Harari)"', () => {
    expect(sonTitulosSimilares('homo-deus', 'Homo Deus (Yuval Harari)')).toBe(true);
  });

  it('"The+vanishing+half" ~= "The Vanishing Half"', () => {
    expect(sonTitulosSimilares('The+vanishing+half', 'The Vanishing Half')).toBe(true);
  });

  it('"ladrona_libros" ~= "La ladrona de libros de Markus Zusak"', () => {
    expect(sonTitulosSimilares('ladrona_libros', 'La ladrona de libros de Markus Zusak')).toBe(true);
  });
});

describe('sonTitulosSimilares — no debe confundir libros distintos', () => {
  it('"El Alquimista" no es "Cien años de soledad"', () => {
    expect(sonTitulosSimilares('El Alquimista', 'Cien años de soledad')).toBe(false);
  });

  it('"El Diario de Ana Frank" no es "Diario de un Escritor"', () => {
    expect(sonTitulosSimilares('El Diario de Ana Frank', 'Diario de un Escritor')).toBe(false);
  });

  it('títulos vacíos nunca son similares', () => {
    expect(sonTitulosSimilares('', 'Becoming')).toBe(false);
    expect(sonTitulosSimilares('Becoming', '')).toBe(false);
  });
});

describe('mejorCoincidencia', () => {
  const candidatos = [
    { titulo: 'Cien años de soledad' },
    { titulo: 'La ladrona de libros de Markus Zusak' },
    { titulo: 'Homo Deus (Yuval Harari)' },
  ];

  it('encuentra el candidato correcto entre varios', () => {
    const resultado = mejorCoincidencia('ladrona_libros', candidatos);
    expect(resultado).toBe(candidatos[1]);
  });

  it('devuelve null si ninguno supera el umbral', () => {
    const resultado = mejorCoincidencia('Sapiens', candidatos);
    expect(resultado).toBeNull();
  });

  it('respeta un getTexto personalizado', () => {
    const archivos = [{ base: 'ladrona_libros' }, { base: 'homo-deus' }];
    const resultado = mejorCoincidencia(
      'La ladrona de libros de Markus Zusak',
      archivos,
      (a) => a.base
    );
    expect(resultado).toBe(archivos[0]);
  });
});
