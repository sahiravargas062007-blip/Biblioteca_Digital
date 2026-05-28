const XLSX = require('xlsx');

/**
 * Parsea un archivo Excel o CSV y devuelve array de objetos
 * CA-01: Valida extensión .xlsx o .csv
 * @param {Buffer} buffer - contenido del archivo
 * @param {string} filename - nombre del archivo (para validar extensión)
 * @returns {Object} { filas: [], errores: [] }
 */
function parsearExcel(buffer, filename) {
  const errores = [];
  const filas = [];

  try {
    // CA-01: Validar extensión
    const ext = filename.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      throw new Error('Solo se permiten archivos .xlsx o .csv');
    }

    // Leer el archivo
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('El archivo Excel está vacío.');

    const worksheet = workbook.Sheets[sheetName];
    const datos = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (datos.length === 0) {
      throw new Error('No se encontraron filas en el Excel.');
    }

    // CA-02: Buscar columna "Nombre del Archivo" (clave primaria)
    const primeraFila = datos[0];
    const nombreArchivoCol = Object.keys(primeraFila).find(
      (col) => col.toLowerCase().includes('nombre') && col.toLowerCase().includes('archivo')
    );

    if (!nombreArchivoCol) {
      throw new Error('No se encontró columna "Nombre del Archivo" en el Excel.');
    }

    // Procesar filas
    datos.forEach((fila, indice) => {
      const nombreArchivo = String(fila[nombreArchivoCol] || '').trim();

      if (!nombreArchivo) {
        errores.push(`Fila ${indice + 2}: "Nombre del Archivo" está vacío.`);
        return;
      }

      // RN-01: Nombre exacto sin extensión
      const nombreLimpio = nombreArchivo.replace(/\.[^/.]+$/, '').trim();

      // Mapear campos disponibles
      const registro = {
        nombreArchivoOriginal: nombreLimpio,
        datosProcesados: {},
      };

      // Campos actualizables (mapeo flexible)
      const camposMapeados = {
        'Título': 'titulo',
        'Autor': 'autor',
        'Editorial': 'editorial',
        'Descripción': 'descripcion',
        'ISBN': 'isbn',
        'Clasificación': 'tipo_material',
        'Fecha Publicación': 'fecha_publicacion',
        'Páginas': 'cantidad_paginas',
        'paginas': 'paginas',
        'Idioma': 'idioma',
        'Duración': 'duracion_segundos',
        'Año': 'fecha_publicacion',
        'Narrador': 'narrador',
        'Director': 'director',
        'Productora': 'productora',
        'URL de imagen': 'imagen_url',
        'Imagen URL': 'imagen_url',
        // Campos dinámicos de metadatos
        'Volumen': 'volumen',
        'Número': 'numero',
        'ISSN': 'issn',
        'Revista': 'revista',
        'DOI': 'doi',
        'Universidad': 'universidad',
        'Programa': 'programa',
        'Tipo de Tesis': 'tipo_tesis',
        'Número de Norma': 'numero_norma',
        'Entidad Emisora': 'entidad_emisora',
        'Diario Oficial': 'diario_oficial',
        'Escala': 'escala',
        'Región': 'region',
        'Proyección': 'proyeccion',
        'Año Cartográfico': 'año_cartografico'
      };

      let tieneAlgunCampo = false;

      for (const [excelCol, mongoField] of Object.entries(camposMapeados)) {
        // Buscar columna flexible (case-insensitive, parcial)
        const colEncontrada = Object.keys(fila).find(
          (col) => col.toLowerCase().includes(excelCol.toLowerCase())
        );

        if (colEncontrada && fila[colEncontrada] !== '') {
          let valor = fila[colEncontrada];

          // Conversiones básicas
          const camposNumericos = ['cantidad_paginas', 'duracion_segundos', 'paginas', 'volumen', 'numero', 'año_cartografico'];
          if (camposNumericos.includes(mongoField)) {
            if (mongoField === 'duracion_segundos' && typeof valor === 'string' && valor.includes(':')) {
              // Convertir HH:MM:SS a segundos
              const partes = valor.split(':').map(Number);
              if (partes.length === 3) {
                valor = partes[0] * 3600 + partes[1] * 60 + partes[2];
              } else if (partes.length === 2) {
                valor = partes[0] * 60 + partes[1];
              } else {
                valor = parseInt(valor) || null;
              }
            } else {
              valor = parseInt(valor) || null;
            }
            if (valor === null) {
              errores.push(
                `Fila ${indice + 2} ("${nombreArchivo}"): "${mongoField}" debe ser numérico.`
              );
              return;
            }
          }

          if (mongoField === 'fecha_publicacion' && valor) {
            // Intentar parsear fecha
            if (!isNaN(new Date(valor).getTime())) {
              valor = new Date(valor).toISOString().split('T')[0];
            }
          }

          registro.datosProcesados[mongoField] = valor;
          tieneAlgunCampo = true;
        }
      }

      if (!tieneAlgunCampo) {
        errores.push(
          `Fila ${indice + 2} ("${nombreArchivo}"): no contiene campos reconocibles.`
        );
        return;
      }

      filas.push(registro);
    });

    return { filas, errores };
  } catch (err) {
    return {
      filas: [],
      errores: [err.message],
    };
  }
}

module.exports = {
  parsearExcel,
};
