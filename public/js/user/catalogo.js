/**
 * BiblioNet Catalog — AJAX filtering & sidebar toggle
 */
(function () {
  'use strict';

  var debounceTimer;
  var grid, countEl, root, catalogMode, apiUrl, detailBaseUrl, countText;

  var currentPage = 1;
  var limit = 15;
  var allRecursos = [];

  document.addEventListener('DOMContentLoaded', function () {
    root    = document.querySelector('.cat-main');
    grid    = document.getElementById('cat-grid');
    countEl = document.getElementById('cat-count');
    catalogMode = root ? root.dataset.catalogMode || 'user' : 'user';
    apiUrl = root ? root.dataset.apiUrl || '/catalogo/api' : '/catalogo/api';
    detailBaseUrl = root ? root.dataset.detailBaseUrl || '/catalogo' : '/catalogo';
    countText = root ? root.dataset.countText || 'recursos disponibles' : 'recursos disponibles';

    if (root && root.dataset.initialRecursos) {
      try {
        allRecursos = JSON.parse(root.dataset.initialRecursos);
      } catch (e) {
        console.error('Error parsing initialRecursos attribute:', e);
        allRecursos = window.initialRecursos || [];
      }
    } else {
      allRecursos = window.initialRecursos || [];
    }
    currentPage = 1;

    initCategoryTree();
    initTypeChips();
    initStatusChips();
    initSearch();
    initClearBtn();
    applyInitialFiltersFromUrl();

    // Auto-filter on checkbox/chip change
    document.querySelectorAll('.cat-tree__checkbox').forEach(function (cb) {
      cb.addEventListener('change', fetchFiltered);
    });

    renderPage();
  });

  /* ── Sidebar Toggle ──────────────────────────────────────────── */
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

  function initStatusChips() {
    var allChip = document.querySelector('[data-status-all]');
    var chips   = document.querySelectorAll('[data-status-chip]');
    if (!allChip && !chips.length) return;

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
        chips.forEach(function (c) {
          if (c !== chip) c.classList.remove('is-active');
        });
        chip.classList.toggle('is-active');
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
      document.querySelectorAll('[data-status-chip]').forEach(function (c) { c.classList.remove('is-active'); });
      var allStatus = document.querySelector('[data-status-all]');
      if (allStatus) allStatus.classList.add('is-active');

      fetchFiltered();
    });
  }

  function applyInitialFiltersFromUrl() {
    var params = new URLSearchParams(window.location.search || '');
    var tipos = (params.get('tipo_material') || '').split(',').filter(Boolean);
    if (tipos.length) {
      var allType = document.querySelector('[data-type-all]');
      if (allType) allType.classList.remove('is-active');
      tipos.forEach(function (tipo) {
        var chip = document.querySelector('[data-type-chip="' + cssEscape(tipo) + '"]');
        if (chip) chip.classList.add('is-active');
      });
    }

    var estado = params.get('estado');
    if (estado) {
      var allStatus = document.querySelector('[data-status-all]');
      var statusChip = document.querySelector('[data-status-chip="' + cssEscape(estado) + '"]');
      if (allStatus && statusChip) allStatus.classList.remove('is-active');
      if (statusChip) statusChip.classList.add('is-active');
    }
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

    var activeStatus = document.querySelector('[data-status-chip].is-active');
    if (activeStatus) params.set('estado', activeStatus.dataset.statusChip);

    var url = apiUrl + (params.toString() ? '?' + params.toString() : '');

    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (recursos) {
        allRecursos = recursos;
        currentPage = 1;
        renderPage();
      })
      .catch(function (err) { console.error('Filter error:', err); });
  }

  /* ── Render Page ─────────────────────────────────────────────── */
  function renderPage() {
    if (!grid) return;
    var start = (currentPage - 1) * limit;
    var end = start + limit;
    var pageRecursos = allRecursos.slice(start, end);
    renderCards(pageRecursos, allRecursos.length);
    renderPagination();
  }

  /* ── Render Pagination ───────────────────────────────────────── */
  function renderPagination() {
    var paginationEl = document.getElementById('cat-pagination');
    if (!paginationEl) return;

    var total = allRecursos.length;
    var totalPages = Math.ceil(total / limit);

    if (totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    var html = '';

    // Previous button
    var prevDisabled = (currentPage === 1) ? ' disabled' : '';
    html += '<button class="cat-pagination__btn cat-pagination__btn--prev"' + prevDisabled + ' data-page="' + (currentPage - 1) + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
      '</button>';

    // Page numbers
    var range = [];
    var delta = 1;
    for (var i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      } else if (range[range.length - 1] !== '...') {
        range.push('...');
      }
    }

    range.forEach(function (p) {
      if (p === '...') {
        html += '<span class="cat-pagination__ellipsis">...</span>';
      } else {
        var activeClass = (p === currentPage) ? ' is-active' : '';
        html += '<button class="cat-pagination__btn' + activeClass + '" data-page="' + p + '">' + p + '</button>';
      }
    });

    // Next button
    var nextDisabled = (currentPage === totalPages) ? ' disabled' : '';
    html += '<button class="cat-pagination__btn cat-pagination__btn--next"' + nextDisabled + ' data-page="' + (currentPage + 1) + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
      '</button>';

    paginationEl.innerHTML = html;

    // Attach click events
    paginationEl.querySelectorAll('.cat-pagination__btn').forEach(function (btn) {
      if (btn.hasAttribute('disabled')) return;
      btn.addEventListener('click', function () {
        var newPage = parseInt(btn.dataset.page, 10);
        if (newPage && newPage >= 1 && newPage <= totalPages) {
          currentPage = newPage;
          renderPage();
          // Scroll up to results list
          var scrollTarget = document.querySelector('.cat-results__header') || root;
          if (scrollTarget) {
            scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });
  }

  /* ── Render Cards ────────────────────────────────────────────── */
  function renderCards(recursos, totalCount) {
    if (!grid) return;

    if (countEl) {
      countEl.textContent = (typeof totalCount !== 'undefined' ? totalCount : recursos.length) + ' ' + countText;
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
    var contentIcons = {
      'Lectura': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
      'Audio': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z"/></svg>',
      'Video': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
    };

    grid.innerHTML = recursos.map(function (r) {
      var imgUrl = (r.imagen && r.imagen.url) ? r.imagen.url : '/img/placeholder.png';
      var icon = typeIcons[r.tipo_material] || typeIcons['default'];
      var detailUrl = detailBaseUrl + '/' + r._id;
      var maxTags = catalogMode === 'admin' ? 4 : 2;
      var tags = (r.categorias || []).slice(0, maxTags).map(function (c) {
        return '<span class="cat-card__tag">' + escapeHtml(c.subcategoria_nombre || c.categoria_nombre) + '</span>';
      }).join('');
      if (catalogMode === 'admin') {
        tags = '<span class="cat-card__tag cat-card__tag--strong">' +
          escapeHtml((r.tipo_naturaleza || '') + '-' + (r.tipo_material || '')) +
          '</span>' + tags;
      }
      var adminBadges = '';
      if (catalogMode === 'admin') {
        var contentIcon = contentIcons[r.tipo_contenido] || contentIcons.Lectura;
        var estadoClass = r.estado === 'Activo' ? 'cat-card__badge--ok' : 'cat-card__badge--muted';
        adminBadges = '<div class="cat-card__badges">' +
          '<span class="cat-card__badge cat-card__badge--content">' + contentIcon + escapeHtml(r.tipo_contenido) + '</span>' +
          '<span class="cat-card__badge ' + estadoClass + '">' + escapeHtml(r.estado) + '</span>' +
        '</div>';
      }

      return '<article class="cat-card' + (catalogMode === 'admin' ? ' cat-card--admin' : '') + '">' +
        '<a class="cat-card__cover" href="' + detailUrl + '">' +
          '<img src="' + escapeHtml(imgUrl) + '" alt="" loading="lazy">' +
          '<span class="cat-card__cover-badge">' + escapeHtml(r.tipo_material || '').toUpperCase() + '</span>' +
          '<span class="cat-card__cover-bookmark">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>' +
            '</svg>' +
          '</span>' +
        '</a>' +
        '<div class="cat-card__body">' +
          adminBadges +
          '<h3 class="cat-card__title"><a href="' + detailUrl + '">' + escapeHtml(r.titulo) + '</a></h3>' +
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

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/"/g, '\\"');
  }

  // Expose for the "Filtrar resultados" button
  window.catalogFetchFiltered = fetchFiltered;
})();
