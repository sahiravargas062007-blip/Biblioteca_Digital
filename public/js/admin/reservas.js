(function () {
  var shell = document.getElementById('reservas-shell');
  var detailPane = document.getElementById('reservas-detail');
  if (!shell || !detailPane) return;

  function cerrarDetalle() {
    shell.classList.remove('is-split');
    detailPane.querySelectorAll('.detail-panel').forEach(function (panel) {
      panel.hidden = true;
    });
    document.querySelectorAll('.reserva-card.is-active').forEach(function (card) {
      card.classList.remove('is-active');
    });
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-ver-detalle]');
    if (trigger) {
      var id = trigger.getAttribute('data-ver-detalle');
      var panel = document.getElementById('detalle-' + id);
      if (!panel) return;

      detailPane.querySelectorAll('.detail-panel').forEach(function (p) {
        p.hidden = (p !== panel);
      });
      document.querySelectorAll('.reserva-card.is-active').forEach(function (card) {
        card.classList.remove('is-active');
      });
      var card = document.getElementById('card-' + id);
      if (card) card.classList.add('is-active');

      shell.classList.add('is-split');
      return;
    }

    if (e.target.closest('[data-cerrar-detalle]')) {
      cerrarDetalle();
    }
  });
})();

/* ── Combobox de búsqueda (Nueva reserva) ─────────────────────── */
(function () {
  var usuariosEl = document.getElementById('usuarios-data');
  var recursosEl = document.getElementById('recursos-data');
  if (!usuariosEl && !recursosEl) return;

  var usuarios = usuariosEl ? JSON.parse(usuariosEl.textContent) : [];
  var recursos = recursosEl ? JSON.parse(recursosEl.textContent) : [];

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
      '<small>Programa: ' + u.programa + ' · Reservas activas: ' + u.reservas_activas + '</small>' +
      '</div>' +
      '<span class="badge ' + (u.estado === 'Activo' ? 'badge-disponible' : 'badge-no-disponible') + '">' + u.estado + '</span>';
  }

  function renderRecursoItem(r) {
    return '<div class="combobox-item" data-id="' + r.id + '">' +
      '<img class="combobox-item__cover" src="' + (r.imagen || '/img/placeholder.png') + '" alt="">' +
      '<div><strong>' + r.titulo + '</strong><small>' + r.autor + ' · ISBN: ' + r.isbn + '</small></div>' +
      '</div>';
  }

  function renderRecursoPreview(r) {
    return '<img class="combobox-item__cover" src="' + (r.imagen || '/img/placeholder.png') + '" alt="">' +
      '<div class="combobox-preview__info">' +
      '<strong>' + r.titulo + '</strong>' +
      '<small>' + r.autor + '</small>' +
      '<small><span class="chip">' + r.tipo + '</span> · ISBN: ' + r.isbn + ' · Ejemplares disponibles: <b>' + r.disponibles + '</b></small>' +
      '</div>';
  }

  function filtrar(lista, texto, campos) {
    var t = texto.trim().toLowerCase();
    if (!t) return lista.slice(0, 8);
    return lista.filter(function (item) {
      return campos.some(function (campo) {
        return String(item[campo] || '').toLowerCase().includes(t);
      });
    }).slice(0, 8);
  }

  function setupCombobox(root) {
    var tipo = root.getAttribute('data-combobox');
    var input = root.querySelector('[data-combobox-input]');
    var menu = root.querySelector('[data-combobox-menu]');
    var hidden = root.querySelector('[data-combobox-value]');
    var preview = root.querySelector('[data-combobox-preview]');

    var datos = tipo === 'usuario' ? usuarios : recursos;
    var campos = tipo === 'usuario' ? ['nombre', 'documento', 'correo'] : ['titulo', 'autor', 'isbn'];
    var renderItem = tipo === 'usuario' ? renderUsuarioItem : renderRecursoItem;
    var renderPreview = tipo === 'usuario' ? renderUsuarioPreview : renderRecursoPreview;

    function mostrarMenu(lista) {
      if (!lista.length) {
        menu.innerHTML = '<p class="combobox-empty">Sin resultados</p>';
      } else {
        menu.innerHTML = lista.map(renderItem).join('');
      }
      menu.hidden = false;
    }

    input.addEventListener('focus', function () {
      mostrarMenu(filtrar(datos, input.value, campos));
    });

    input.addEventListener('input', function () {
      hidden.value = '';
      preview.hidden = true;
      mostrarMenu(filtrar(datos, input.value, campos));
    });

    menu.addEventListener('click', function (e) {
      var item = e.target.closest('[data-id]');
      if (!item) return;
      var id = item.getAttribute('data-id');
      var seleccionado = datos.find(function (d) { return String(d.id) === id; });
      if (!seleccionado) return;

      hidden.value = seleccionado.id;
      input.value = tipo === 'usuario' ? seleccionado.nombre : seleccionado.titulo;
      preview.innerHTML = renderPreview(seleccionado);
      preview.hidden = false;
      menu.hidden = true;
    });

    document.addEventListener('click', function (e) {
      if (!root.contains(e.target)) menu.hidden = true;
    });
  }

  document.querySelectorAll('[data-combobox]').forEach(setupCombobox);
})();
