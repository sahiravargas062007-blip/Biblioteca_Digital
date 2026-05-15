/**
 * BiblioNet Catalog — AJAX filtering & sidebar toggle
 */
(function () {
  'use strict';

  var debounceTimer;
  var grid, countEl;

  document.addEventListener('DOMContentLoaded', function () {
    grid    = document.getElementById('cat-grid');
    countEl = document.getElementById('cat-count');

    initSidebarToggle();
    initCategoryTree();
    initTypeChips();
    initSearch();
    initClearBtn();

    // Auto-filter on checkbox/chip change
    document.querySelectorAll('.cat-tree__checkbox').forEach(function (cb) {
      cb.addEventListener('change', fetchFiltered);
    });
  });

  /* ── Sidebar Toggle ──────────────────────────────────────────── */
  function initSidebarToggle() {
    var toggle  = document.getElementById('sidebar-toggle');
    var sidebar = document.getElementById('cat-sidebar');
    var overlay = document.getElementById('cat-overlay');
    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('is-collapsed');
      if (overlay) overlay.classList.remove('is-visible');
    });

    if (overlay) {
      overlay.addEventListener('click', function () {
        sidebar.classList.add('is-collapsed');
        overlay.classList.remove('is-visible');
      });
    }
  }

  /* ── Category Tree ───────────────────────────────────────────── */
  function initCategoryTree() {
    document.querySelectorAll('.cat-tree__header').forEach(function (header) {
      header.addEventListener('click', function (e) {
        // Don't toggle tree when clicking the checkbox itself
        if (e.target.type === 'checkbox') return;
        var item = header.closest('.cat-tree__item');
        item.classList.toggle('is-open');
      });
    });

    // Parent checkbox toggles all children
    document.querySelectorAll('[data-cat-parent]').forEach(function (parentCb) {
      parentCb.addEventListener('change', function () {
        var catId = parentCb.dataset.catParent;
        var children = document.querySelectorAll('[data-cat-child="' + catId + '"]');
        children.forEach(function (child) { child.checked = parentCb.checked; });
        fetchFiltered();
      });
    });

    // Child checkbox updates parent state
    document.querySelectorAll('[data-cat-child]').forEach(function (childCb) {
      childCb.addEventListener('change', function () {
        var catId = childCb.dataset.catChild;
        var parent = document.querySelector('[data-cat-parent="' + catId + '"]');
        var siblings = document.querySelectorAll('[data-cat-child="' + catId + '"]');
        if (!parent) return;
        var allChecked = Array.from(siblings).every(function (s) { return s.checked; });
        var someChecked = Array.from(siblings).some(function (s) { return s.checked; });
        parent.checked = allChecked;
        parent.indeterminate = !allChecked && someChecked;
        fetchFiltered();
      });
    });
  }

  /* ── Type Chips ──────────────────────────────────────────────── */
  function initTypeChips() {
    var allChip = document.querySelector('[data-type-all]');
    var chips   = document.querySelectorAll('[data-type-chip]');

    if (allChip) {
      allChip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('is-active'); });
        allChip.classList.add('is-active');
        fetchFiltered();
      });
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        if (allChip) allChip.classList.remove('is-active');
        chip.classList.toggle('is-active');
        // If none active, reactivate "Todos"
        var anyActive = Array.from(chips).some(function (c) { return c.classList.contains('is-active'); });
        if (!anyActive && allChip) allChip.classList.add('is-active');
        fetchFiltered();
      });
    });
  }

  /* ── Search ──────────────────────────────────────────────────── */
  function initSearch() {
    var searchInput = document.getElementById('cat-search');
    if (!searchInput) return;
    searchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchFiltered, 350);
    });
  }

  /* ── Clear All ───────────────────────────────────────────────── */
  function initClearBtn() {
    var btn = document.getElementById('cat-clear');
    if (!btn) return;
    btn.addEventListener('click', function () {
      // Clear search
      var searchInput = document.getElementById('cat-search');
      if (searchInput) searchInput.value = '';
      // Clear checkboxes
      document.querySelectorAll('.cat-tree__checkbox').forEach(function (cb) {
        cb.checked = false;
        cb.indeterminate = false;
      });
      // Reset chips
      document.querySelectorAll('[data-type-chip]').forEach(function (c) { c.classList.remove('is-active'); });
      var allChip = document.querySelector('[data-type-all]');
      if (allChip) allChip.classList.add('is-active');

      fetchFiltered();
    });
  }

  /* ── Fetch Filtered Results ──────────────────────────────────── */
  function fetchFiltered() {
    var params = new URLSearchParams();

    // Search query
    var q = (document.getElementById('cat-search') || {}).value || '';
    if (q.trim()) params.set('q', q.trim());

    // Type chips
    var activeTypes = [];
    document.querySelectorAll('[data-type-chip].is-active').forEach(function (c) {
      activeTypes.push(c.dataset.typeChip);
    });
    if (activeTypes.length) params.set('tipo_material', activeTypes.join(','));

    // Category checkboxes (parents)
    var catIds = [];
    document.querySelectorAll('[data-cat-parent]:checked').forEach(function (cb) {
      catIds.push(cb.dataset.catParent);
    });
    if (catIds.length) params.set('categorias', catIds.join(','));

    // Subcategory checkboxes
    var subIds = [];
    document.querySelectorAll('[data-cat-child]:checked').forEach(function (cb) {
      // Only add if parent is NOT fully checked (otherwise category filter suffices)
      var parentCb = document.querySelector('[data-cat-parent="' + cb.dataset.catChild + '"]');
      if (!parentCb || !parentCb.checked) {
        subIds.push(cb.value);
      }
    });
    if (subIds.length) params.set('subcategorias', subIds.join(','));

    var url = '/catalogo/api?' + params.toString();

    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (recursos) { renderCards(recursos); })
      .catch(function (err) { console.error('Filter error:', err); });
  }

  /* ── Render Cards ────────────────────────────────────────────── */
  function renderCards(recursos) {
    if (!grid) return;

    if (countEl) {
      countEl.textContent = recursos.length + ' recursos disponibles';
    }

    if (!recursos.length) {
      grid.innerHTML = '<div class="cat-empty"><h2>No hay recursos para mostrar</h2><p>Ajusta los filtros o la búsqueda para encontrar resultados.</p></div>';
      return;
    }

    var typeIcons = {
      'Libro': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
      'Revista': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>',
      'Tesis': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5"/></svg>',
      'Artículo': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      'Audiolibro': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z"/></svg>',
      'Video': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
      'default': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>'
    };

    grid.innerHTML = recursos.map(function (r) {
      var imgUrl = (r.imagen && r.imagen.url) ? r.imagen.url : '/img/placeholder.png';
      var icon = typeIcons[r.tipo_material] || typeIcons['default'];
      var tags = (r.categorias || []).slice(0, 2).map(function (c) {
        return '<span class="cat-card__tag">' + escapeHtml(c.subcategoria_nombre || c.categoria_nombre) + '</span>';
      }).join('');

      return '<article class="cat-card">' +
        '<a class="cat-card__cover" href="/catalogo/' + r._id + '">' +
          '<img src="' + escapeHtml(imgUrl) + '" alt="" loading="lazy">' +
        '</a>' +
        '<div class="cat-card__body">' +
          '<h3 class="cat-card__title"><a href="/catalogo/' + r._id + '">' + escapeHtml(r.titulo) + '</a></h3>' +
          '<p class="cat-card__author">' + escapeHtml(r.autor) + '</p>' +
          (tags ? '<div class="cat-card__tags">' + tags + '</div>' : '') +
          '<div class="cat-card__footer">' +
            '<span class="cat-card__type">' + icon + ' ' + escapeHtml(r.tipo_material) + '</span>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Expose for the "Filtrar resultados" button
  window.catalogFetchFiltered = fetchFiltered;
})();
