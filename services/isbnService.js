// Tiempo máximo de espera a Open Library (ms)
const TIMEOUT_MS = 8000;

/**
 * Busca metadata de un libro en Open Library por ISBN.
 * Devuelve null si no se encuentra o si la red falla
 * (no lanza excepción para no romper el flujo del formulario).
 */
exports.buscarPorIsbn = async (isbn) => {
  const url = `https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`;

  // AbortController para aplicar timeout manual (fetch no tiene timeout nativo)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (response.status === 404) return null;
    if (!response.ok) return null; // Cualquier error HTTP → devolver null, no lanzar

    return await response.json();
  } catch (err) {
    clearTimeout(timer);

    // Timeout (AbortError) o error de red → devolver null silenciosamente
    // El controlador ya maneja el caso null mostrando alerta al usuario
    if (err.name === 'AbortError' || err.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      console.warn('[isbnService] Timeout al consultar Open Library para ISBN:', isbn);
      return null;
    }

    // Cualquier otro error de red → también null (no romper el formulario)
    console.warn('[isbnService] Error al consultar Open Library:', err.message);
    return null;
  }
};
