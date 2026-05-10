document.addEventListener('click', (event) => {
  if (event.target.matches('[data-add-subcategoria]')) {
    const target = document.querySelector(event.target.dataset.addSubcategoria);
    if (!target) return;

    target.insertAdjacentHTML('beforeend', `
      <div class="subcategoria-row">
        <label>
          Nombre
          <input name="sub_nombre">
        </label>
        <label>
          Código Dewey
          <input name="sub_codigo_dewey">
        </label>
        <label>
          Descripción
          <input name="sub_descripcion">
        </label>
        <button type="button" class="danger-button" data-remove-subcategoria>Quitar</button>
      </div>
    `);
  }

  if (event.target.matches('[data-remove-subcategoria]')) {
    const row = event.target.closest('.subcategoria-row');
    if (row) row.remove();
  }
});
