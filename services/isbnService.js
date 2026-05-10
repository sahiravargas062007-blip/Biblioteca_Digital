exports.buscarPorIsbn = async (isbn) => {
  const response = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('No fue posible consultar Open Library.');
  return response.json();
};
