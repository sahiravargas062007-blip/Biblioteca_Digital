const mongoose = require('mongoose');

const METADATOS_SCHEMA = {
  "Libro": {
    requeridos: ["editorial", "paginas"],
    opcionales: ["isbn"],
    autocompletar: "ISBN"  // via Open Library
  },
  "Revista": {
    requeridos: ["volumen", "numero"],
    opcionales: ["issn"],
    autocompletar: "ISSN"  // via ROAD (opcional, limitado)
  },
  "Artículo": {
    requeridos: ["revista"],
    opcionales: ["doi", "volumen"],
    autocompletar: "DOI"   // via CrossRef API ✅
  },
  "Tesis": {
    requeridos: ["universidad", "programa", "tipo_tesis"],
    opcionales: ["director"],
    autocompletar: null    // manual
  },
  "Ley y Normativa": {
    requeridos: ["numero_norma", "entidad_emisora"],
    opcionales: ["diario_oficial"],
    autocompletar: null    // manual
  },
  "Mapa": {
    requeridos: ["escala", "region"],
    opcionales: ["proyeccion", "año_cartografico"],
    autocompletar: null    // manual
  }
};

function validarMetadatos(tipoMaterial, metadatos) {
  const schema = METADATOS_SCHEMA[tipoMaterial];
  if (!schema) {
    return { valido: false, error: `Tipo de material no reconocido: ${tipoMaterial}` };
  }

  // Convertir Map a objeto normal si aplica
  const keys = metadatos instanceof Map 
    ? Object.fromEntries(metadatos) 
    : (typeof metadatos.toObject === 'function' ? metadatos.toObject() : (metadatos || {}));
  const faltantes = [];

  // Verificar requeridos
  for (const campo of schema.requeridos) {
    if (keys[campo] === undefined || keys[campo] === null || String(keys[campo]).trim() === "") {
      faltantes.push(campo);
    }
  }

  if (faltantes.length > 0) {
    return { valido: false, error: `Faltan campos obligatorios para ${tipoMaterial}: ${faltantes.join(', ')}`, faltantes };
  }

  // Filtrar para que solo queden las claves del tipo correspondiente (CA8)
  const permitidos = [...schema.requeridos, ...schema.opcionales];
  const metadatosFiltrados = {};
  for (const campo of permitidos) {
    if (keys[campo] !== undefined && keys[campo] !== null && String(keys[campo]).trim() !== "") {
      // Conversión numérica para campos enteros
      if (["paginas", "volumen", "numero", "año_cartografico"].includes(campo)) {
        const num = Number(keys[campo]);
        metadatosFiltrados[campo] = isNaN(num) ? keys[campo] : num;
      } else {
        metadatosFiltrados[campo] = keys[campo];
      }
    }
  }

  return { valido: true, metadatos: metadatosFiltrados };
}

module.exports = {
  METADATOS_SCHEMA,
  validarMetadatos
};
