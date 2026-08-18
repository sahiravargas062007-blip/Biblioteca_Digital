const AdmZip = require('adm-zip');
const { analizarZip } = require('../../../controllers/admin/recurso/masivoZip');

function crearZip(archivos) {
  const zip = new AdmZip();
  for (const { ruta, contenido } of archivos) {
    zip.addFile(ruta, Buffer.from(contenido || 'contenido'));
  }
  return zip;
}

describe('analizarZip — archivos sueltos en la raíz (sin carpetas)', () => {
  it('empareja cada mp3 con la portada de nombre más parecido', () => {
    const zip = crearZip([
      { ruta: 'El Alquimista.jfif' },
      { ruta: 'El alquimista - paulo Coelho.mp3' },
      { ruta: 'Becoming.jpg' },
      { ruta: 'Becoming de Michelle Obama.mp3' },
    ]);

    const { recursos, errores } = analizarZip(zip, 'Audio');

    expect(errores).toHaveLength(0);
    expect(recursos).toHaveLength(2);
    expect(recursos.every((r) => r.tieneMain)).toBe(true);
    expect(recursos.every((r) => r.tienePortada)).toBe(true);
  });
});

describe('analizarZip — una única carpeta envolviendo todo el lote', () => {
  it('trata "Audiolibros/" (una sola carpeta) como modo suelto, no como un recurso', () => {
    // Este es el caso real reportado: comprimir una carpeta desde Windows
    // envuelve todos los archivos bajo una sola carpeta contenedora.
    const zip = crearZip([
      { ruta: 'Audiolibros/El Alquimista.jfif' },
      { ruta: 'Audiolibros/El alquimista - paulo Coelho.mp3' },
      { ruta: 'Audiolibros/Becoming.jpg' },
      { ruta: 'Audiolibros/Becoming de Michelle Obama.mp3' },
      { ruta: 'Audiolibros/homo-deus.webp' },
      { ruta: 'Audiolibros/Homo Deus (Yuval Harari).mp3' },
    ]);

    const { recursos, errores } = analizarZip(zip, 'Audio');

    expect(errores).toHaveLength(0);
    // 3 recursos, NO 1 solo llamado "Audiolibros"
    expect(recursos).toHaveLength(3);
    expect(recursos.map((r) => r.titulo)).not.toContain('Audiolibros');
    expect(recursos.every((r) => r.tieneMain && r.tienePortada)).toBe(true);
  });
});

describe('analizarZip — varias carpetas distintas (una por recurso)', () => {
  it('usa el nombre de cada carpeta como el recurso, cuando hay 2+ carpetas', () => {
    const zip = crearZip([
      { ruta: 'El Quijote/main.pdf' },
      { ruta: 'El Quijote/portada.jpg' },
      { ruta: 'Cien Años de Soledad/main.pdf' },
      { ruta: 'Cien Años de Soledad/portada.jpg' },
    ]);

    const { recursos, errores } = analizarZip(zip, 'Lectura');

    expect(errores).toHaveLength(0);
    expect(recursos).toHaveLength(2);
    const titulos = recursos.map((r) => r.titulo).sort();
    expect(titulos).toEqual(['Cien Años de Soledad', 'El Quijote']);
  });

  it('reporta error si una de las carpetas no tiene archivo principal', () => {
    const zip = crearZip([
      { ruta: 'El Quijote/main.pdf' },
      { ruta: 'Cien Años de Soledad/portada.jpg' }, // sin PDF/EPUB
      { ruta: 'Ficción Breve/main.pdf' },
    ]);

    const { recursos, errores } = analizarZip(zip, 'Lectura');

    expect(errores.length).toBeGreaterThan(0);
    const conError = recursos.find((r) => r.titulo === 'Cien Años de Soledad');
    expect(conError.tieneMain).toBe(false);
  });
});
