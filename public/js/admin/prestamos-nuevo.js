/* ── Combobox de búsqueda de usuario (Nuevo préstamo) ─────────────
   Mismo patrón que /js/admin/reservas.js: filtra un JSON embebido
   en el propio HTML, sin llamadas al servidor. ── */
(function () {
  var usuariosEl = document.getElementById('usuarios-data');
  if (!usuariosEl) return;

  var usuarios = JSON.parse(usuariosEl.textContent);

  function normalizar(texto) {
    return String(texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function iniciales(nombre) {
    var partes = (nombre || '').trim().split(/\s+/);
    return ((partes[0] ? partes[0][0] : '') + (partes[1] ? partes[1][0] : '')).toUpperCase();
  }

  function renderUsuarioItem(u) {
    return '<div class="combobox-item" data-id="' + u.id + '">' +
      '<span class="combobox-item__avatar">' + iniciales(u.nombre) + '</span>' +
      '<div><strong>' + u.nombre + '</strong><small>' + u.documento + ' · ' + u.correo + '</small></div>' +
      '</div>';
  }

  function renderUsuarioPreview(u) {
    return '<span class="combobox-item__avatar">' + iniciales(u.nombre) + '</span>' +
      '<div class="combobox-preview__info">' +
      '<strong>' + u.nombre + '</strong>' +
      '<small>' + u.documento + ' · ' + u.correo + '</small>' +
      '<small>Programa: ' + u.programa + ' · Préstamos activos: ' + u.prestamos_activos + '</small>' +
      '</div>' +
      '<span class="badge ' + (u.estado === 'Activo' ? 'badge-disponible' : 'badge-no-disponible') + '">' + u.estado + '</span>';
  }

  function filtrar(lista, texto) {
    var t = normalizar(texto).trim();
    if (!t) return lista.slice(0, 8);
    return lista.filter(function (item) {
      return ['nombre', 'documento', 'correo'].some(function (campo) {
        return normalizar(item[campo]).includes(t);
      });
    }).slice(0, 8);
  }

  function setupCombobox(root) {
    var input = root.querySelector('[data-combobox-input]');
    var menu = root.querySelector('[data-combobox-menu]');
    var hidden = root.querySelector('[data-combobox-value]');
    var preview = root.querySelector('[data-combobox-preview]');
    if (!input || !menu || !hidden || !preview) return;

    function mostrarMenu(lista) {
      if (!lista.length) {
        menu.innerHTML = '<p class="combobox-empty">Sin resultados</p>';
      } else {
        menu.innerHTML = lista.map(renderUsuarioItem).join('');
      }
      menu.hidden = false;
    }

    input.addEventListener('focus', function () {
      mostrarMenu(filtrar(usuarios, input.value));
    });

    input.addEventListener('input', function () {
      hidden.value = '';
      preview.hidden = true;
      mostrarMenu(filtrar(usuarios, input.value));
    });

    menu.addEventListener('click', function (e) {
      var item = e.target.closest('[data-id]');
      if (!item) return;
      var id = item.getAttribute('data-id');
      var seleccionado = usuarios.find(function (u) { return String(u.id) === id; });
      if (!seleccionado) return;

      hidden.value = seleccionado.id;
      input.value = seleccionado.nombre;
      preview.innerHTML = renderUsuarioPreview(seleccionado);
      preview.hidden = false;
      menu.hidden = true;
    });

    document.addEventListener('click', function (e) {
      if (!root.contains(e.target)) menu.hidden = true;
    });
  }

  var root = document.querySelector('[data-combobox="usuario"]');
  if (root) setupCombobox(root);
})();

/* ── Filtro y contador de ejemplares (Nuevo préstamo) ─────────────
   Todos los ejemplares ya vienen renderizados por el servidor como
   checkboxes reales; aquí solo se muestran/ocultan filas según el
   texto buscado y se actualiza el contador de seleccionados. ── */
(function () {
  var listEl = document.querySelector('[data-ejemplares-list]');
  if (!listEl) return;

  var filterInput = document.getElementById('ejemplar-filter');
  var countBadge = document.querySelector('[data-ejemplares-count]');
  var sinResultados = document.querySelector('[data-ejemplares-sin-resultados]');
  var rows = Array.prototype.slice.call(listEl.querySelectorAll('[data-ejemplar-row]'));

  function normalizar(texto) {
    return String(texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function actualizarContador() {
    var seleccionados = rows.filter(function (row) {
      return row.querySelector('[data-ejemplar-checkbox]').checked;
    }).length;

    if (!countBadge) return;
    if (seleccionados > 0) {
      countBadge.hidden = false;
      countBadge.textContent = seleccionados + (seleccionados === 1 ? ' seleccionado' : ' seleccionados');
    } else {
      countBadge.hidden = true;
    }
  }

  function filtrarEjemplares() {
    var texto = normalizar(filterInput.value);
    var visibles = 0;
    rows.forEach(function (row) {
      var coincide = !texto || normalizar(row.getAttribute('data-search')).includes(texto);
      row.hidden = !coincide;
      if (coincide) visibles += 1;
    });
    if (sinResultados) sinResultados.hidden = visibles !== 0 || rows.length === 0;
  }

  if (filterInput) {
    filterInput.addEventListener('input', filtrarEjemplares);
  }

  rows.forEach(function (row) {
    row.querySelector('[data-ejemplar-checkbox]').addEventListener('change', actualizarContador);
  });

  actualizarContador();
})();
