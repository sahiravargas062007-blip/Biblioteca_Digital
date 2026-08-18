// Compara títulos/nombres de archivo de forma tolerante a cómo la gente
// realmente nombra sus archivos: mayúsculas/minúsculas, tildes,
// guiones/guiones_bajos/+, y palabras de más (autor, año, etc).
//
// Ejemplos que este servicio SÍ debe reconocer como el mismo recurso:
//   "El Alquimista"        ~= "El alquimista - paulo Coelho"
//   "Becoming"              ~= "Becoming de Michelle Obama"
//   "homo-deus"              ~= "Homo Deus (Yuval Harari)"
//   "The+vanishing+half"      ~= "The Vanishing Half"
//   "ladrona_libros"           ~= "La ladrona de libros de Markus Zusak"

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'y', 'o', 'en', 'a', 'the', 'of', 'and',
]);

// Umbral: qué fracción de los tokens del título más corto debe aparecer
// en el más largo para considerarlos "el mismo recurso".
const UMBRAL_SIMILITUD = 0.8;

function normalizarTitulo(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')      // quita tildes
    .replace(/[_+-]/g, ' ')               // guiones/guiones_bajos/+ como separadores
    .replace(/[^a-zA-Z0-9\s]/g, ' ')      // resto de puntuación fuera
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensSignificativos(text) {
  return normalizarTitulo(text)
    .split(' ')
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

/**
 * Devuelve un score 0..1: qué fracción de los tokens del título más corto
 * (a o b, el que tenga menos palabras significativas) aparece también en
 * el más largo. 1.0 = todas las palabras del más corto están en el otro.
 */
function calcularSimilitud(a, b) {
  const tokensA = tokensSignificativos(a);
  const tokensB = tokensSignificativos(b);
  if (!tokensA.length || !tokensB.length) return 0;

  const [cortos, largos] = tokensA.length <= tokensB.length
    ? [tokensA, tokensB]
    : [tokensB, tokensA];

  const setLargos = new Set(largos);
  const coincidencias = cortos.filter((token) => setLargos.has(token)).length;

  return coincidencias / cortos.length;
}

function sonTitulosSimilares(a, b, umbral = UMBRAL_SIMILITUD) {
  return calcularSimilitud(a, b) >= umbral;
}

/**
 * De una lista de candidatos, devuelve el que tenga mayor similitud con
 * `titulo` (según getTexto para extraer el texto comparable de cada
 * candidato), siempre que supere el umbral. Si ninguno lo supera, null.
 */
function mejorCoincidencia(titulo, candidatos, getTexto = (c) => c.titulo, umbral = UMBRAL_SIMILITUD) {
  let mejor = null;
  let mejorScore = 0;

  for (const candidato of candidatos) {
    const score = calcularSimilitud(titulo, getTexto(candidato));
    if (score > mejorScore) {
      mejorScore = score;
      mejor = candidato;
    }
  }

  return mejorScore >= umbral ? mejor : null;
}

module.exports = {
  UMBRAL_SIMILITUD,
  normalizarTitulo,
  tokensSignificativos,
  calcularSimilitud,
  sonTitulosSimilares,
  mejorCoincidencia,
};
