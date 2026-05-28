const TIMEOUT_MS = 8000;

/**
 * Busca metadata de un artículo en CrossRef por DOI.
 * Devuelve un objeto parsed o null si no se encuentra.
 */
exports.buscarPorDoi = async (doi) => {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BibliotecaDigital/1.0 (mailto:soporte@biblioteca.edu)' },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (response.status === 404) return null;
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== 'ok' || !data.message) return null;

    const message = data.message;

    // Parsear título
    const title = message.title && message.title.length > 0 ? message.title[0] : '';

    // Parsear autor(es)
    let autor = '';
    if (message.author && message.author.length > 0) {
      autor = message.author.map(a => {
        const given = a.given || '';
        const family = a.family || '';
        return `${given} ${family}`.trim();
      }).filter(Boolean).join(', ');
    }

    // Parsear revista
    const revista = message['container-title'] && message['container-title'].length > 0
      ? message['container-title'][0]
      : '';

    // Parsear volumen
    const volumen = message.volume || '';

    // Parsear fecha
    let fecha_publicacion = '';
    if (message.published && message.published['date-parts'] && message.published['date-parts'][0]) {
      const parts = message.published['date-parts'][0];
      const year = parts[0];
      const month = String(parts[1] || 1).padStart(2, '0');
      const day = String(parts[2] || 1).padStart(2, '0');
      if (year) {
        fecha_publicacion = `${year}-${month}-${day}`;
      }
    }

    return {
      title,
      autor,
      revista,
      volumen,
      fecha_publicacion
    };
  } catch (err) {
    clearTimeout(timer);
    console.warn('[doiService] Error al consultar CrossRef:', err.message);
    return null;
  }
};
