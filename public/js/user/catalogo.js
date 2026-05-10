document.addEventListener('input', (event) => {
  if (!event.target.matches('[data-catalog-search]')) return;
  document.dispatchEvent(new CustomEvent('catalogo:buscar', { detail: event.target.value }));
});
