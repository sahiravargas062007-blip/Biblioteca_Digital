async function buscarIsbn(isbn) {
  const response = await fetch(`/admin/recursos/isbn/${encodeURIComponent(isbn)}`);
  return response.json();
}

window.bibliotecaRecursos = { buscarIsbn };

const materialOptions = {
  Lectura: ['Libro', 'Revista', 'Tesis', 'Artículo', 'Ley y Normativa', 'Mapa'],
  Audio: ['Audiolibro'],
  Video: ['Video']
};

function syncMaterialOptions() {
  const contentType = document.querySelector('[data-content-type]');
  const materialType = document.querySelector('[data-material-type]');
  if (!contentType || !materialType) return;

  const current = materialType.value;
  const options = materialOptions[contentType.value] || [];
  materialType.innerHTML = options.map((option) => (
    `<option value="${option}" ${option === current ? 'selected' : ''}>${option}</option>`
  )).join('');
}

function syncSections() {
  const nature = document.querySelector('[data-resource-nature]')?.value;
  const digital = document.querySelector('[data-digital-section]');
  const physical = document.querySelector('[data-physical-section]');

  if (digital) digital.hidden = !['Digital', 'Mixto'].includes(nature);
  if (physical) physical.hidden = !['Físico', 'Mixto'].includes(nature);
}

function syncSubcategories() {
  const categorySelect = document.querySelector('[data-category-select]');
  const subcategorySelect = document.querySelector('[data-subcategory-select]');
  if (!categorySelect || !subcategorySelect) return;

  const category = (window.BIBLIOTECA_CATEGORIAS || []).find((item) => String(item._id) === categorySelect.value);
  const current = window.BIBLIOTECA_SUBCATEGORIA_ACTUAL || subcategorySelect.value;
  const subcategories = category?.subcategorias || [];

  subcategorySelect.innerHTML = '<option value="">Sin subcategoría</option>' + subcategories.map((subcategoria) => (
    `<option value="${subcategoria._id}" ${String(subcategoria._id) === String(current) ? 'selected' : ''}>${subcategoria.nombre}</option>`
  )).join('');

  window.BIBLIOTECA_SUBCATEGORIA_ACTUAL = '';
}

function fillInput(name, value) {
  const input = document.querySelector(`[name="${name}"]`);
  if (input && value) input.value = value;
}

async function handleIsbnSearch() {
  const input = document.querySelector('[data-isbn]');
  if (!input || !input.value.trim()) return;

  const data = await buscarIsbn(input.value.trim());
  if (!data || !Object.keys(data).length) {
    alert('No se encontraron datos para ese ISBN.');
    return;
  }

  fillInput('titulo', data.title);
  fillInput('editorial', Array.isArray(data.publishers) ? data.publishers[0] : '');
  fillInput('cantidad_paginas', data.number_of_pages);
  fillInput('fecha_publicacion', data.publish_date ? `${data.publish_date.match(/\d{4}/)?.[0] || ''}-01-01` : '');
}

document.addEventListener('DOMContentLoaded', () => {
  syncMaterialOptions();
  syncSections();
  syncSubcategories();
});

document.addEventListener('change', (event) => {
  if (event.target.matches('[data-content-type]')) syncMaterialOptions();
  if (event.target.matches('[data-resource-nature]')) syncSections();
  if (event.target.matches('[data-category-select]')) syncSubcategories();
});

document.addEventListener('click', (event) => {
  if (event.target.matches('[data-isbn-search]')) handleIsbnSearch();
});
