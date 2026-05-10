// ── Utilidades ────────────────────────────────────────────────────────────
function show(id) { var el = document.getElementById(id); if (el) el.style.display = ''; }
function hide(id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; }
function val(id)  { var el = document.getElementById(id); return el ? el.value : ''; }

// ── Sincronizar tipo de material según tipo de contenido ──────────────────
var materialOptions = {
  Lectura: ['Libro', 'Revista', 'Tesis', 'Artículo', 'Ley y Normativa', 'Mapa'],
  Audio:   ['Audiolibro'],
  Video:   ['Video']
};

function syncMaterialOptions() {
  var contentType  = val('tipo_contenido');
  var materialSel  = document.getElementById('tipo_material');
  if (!materialSel) return;

  var current = materialSel.value;
  var options = materialOptions[contentType] || [];
  materialSel.innerHTML = options.map(function(opt) {
    return '<option value="' + opt + '"' + (opt === current ? ' selected' : '') + '>' + opt + '</option>';
  }).join('');
}

// ── Mostrar / ocultar secciones según tipo de contenido y naturaleza ──────
function syncForm() {
  var contenido  = val('tipo_contenido');
  var naturaleza = val('tipo_naturaleza');

  // Sección digital
  var showDigital = naturaleza === 'Digital' || naturaleza === 'Mixto';
  document.getElementById('digital-section').style.display = showDigital ? '' : 'none';

  // Sección física
  var showFisico = naturaleza === 'Físico' || naturaleza === 'Mixto';
  document.getElementById('physical-section').style.display = showFisico ? '' : 'none';

  // Bloques de archivo según tipo de contenido
  var lectura = contenido === 'Lectura';
  var audio   = contenido === 'Audio';
  var video   = contenido === 'Video';

  document.getElementById('archivo-lectura-block').style.display = lectura ? '' : 'none';
  document.getElementById('archivo-audio-block').style.display   = audio   ? '' : 'none';
  document.getElementById('archivo-video-block').style.display   = video   ? '' : 'none';

  // Campos específicos de audio y video
  document.getElementById('audio-fields').style.display = audio ? '' : 'none';
  document.getElementById('video-fields').style.display = video ? '' : 'none';

  // ISBN: visible en Lectura siempre, en Audio si es audiolibro comercial
  var isbnRow = document.getElementById('isbn-row');
  if (isbnRow) isbnRow.style.display = (lectura || audio) ? '' : 'none';

  // Páginas solo para Lectura
  var paginasWrap = document.getElementById('paginas-wrap');
  if (paginasWrap) paginasWrap.style.display = lectura ? '' : 'none';

  // Duración para Audio y Video
  var duracionWrap = document.getElementById('duracion-wrap');
  if (duracionWrap) duracionWrap.style.display = (audio || video) ? '' : 'none';

  // Label del autor
  var labelAutor = document.getElementById('label-autor');
  if (labelAutor) {
    if (audio)   labelAutor.textContent = 'Autor / Creador del libro original';
    else if (video) labelAutor.textContent = 'Director / Creador';
    else         labelAutor.textContent = 'Autor / Creador';
  }

  // Label imagen
  var labelImagen = document.getElementById('label-imagen');
  if (labelImagen) {
    if (audio)  labelImagen.textContent = 'Carátula del audiolibro';
    else if (video) labelImagen.textContent = 'Thumbnail / miniatura';
    else        labelImagen.textContent = 'Imagen de portada';
  }

  // Editorial solo para Lectura y Audio
  var editorialWrap = document.getElementById('label-editorial-wrap');
  if (editorialWrap) editorialWrap.style.display = video ? 'none' : '';
}

// ── Licencia restringida ──────────────────────────────────────────────────
function syncLicencia() {
  var licenciaSel = document.getElementById('licencia-select');
  if (!licenciaSel) return;
  var block = document.getElementById('licencia-restringida-block');
  if (block) block.style.display = licenciaSel.value === 'Restringida' ? '' : 'none';
}

// ── Origen de video (URL o archivo) ──────────────────────────────────────
function syncVideoOrigen() {
  var sel = document.getElementById('video-origen-select');
  if (!sel) return;
  var urlBlock     = document.getElementById('video-url-block');
  var archivoBlock = document.getElementById('video-archivo-block');
  if (sel.value === 'url') {
    if (urlBlock)     urlBlock.style.display = '';
    if (archivoBlock) archivoBlock.style.display = 'none';
  } else {
    if (urlBlock)     urlBlock.style.display = 'none';
    if (archivoBlock) archivoBlock.style.display = '';
  }
}

// ── Subcategorías ─────────────────────────────────────────────────────────
function syncSubcategories() {
  var categorySelect    = document.getElementById('categoria-select');
  var subcategorySelect = document.getElementById('subcategoria-select');
  if (!categorySelect || !subcategorySelect) return;

  var category   = (window.BIBLIOTECA_CATEGORIAS || []).find(function(item) {
    return String(item._id) === categorySelect.value;
  });
  var current        = window.BIBLIOTECA_SUBCATEGORIA_ACTUAL || subcategorySelect.value;
  var subcategories  = category ? (category.subcategorias || []) : [];

  subcategorySelect.innerHTML = '<option value="">Sin subcategoría</option>' +
    subcategories.map(function(s) {
      return '<option value="' + s._id + '"' +
        (String(s._id) === String(current) ? ' selected' : '') + '>' + s.nombre + '</option>';
    }).join('');

  window.BIBLIOTECA_SUBCATEGORIA_ACTUAL = '';
}

// ── Convertir HH:MM:SS → segundos al enviar ───────────────────────────────
function hhmmssToSegundos(str) {
  var parts = String(str || '').split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(str) || 0;
}

// ── Búsqueda ISBN ─────────────────────────────────────────────────────────
async function handleIsbnSearch() {
  var input = document.getElementById('isbn-input');
  if (!input || !input.value.trim()) return;

  var hint = document.getElementById('isbn-hint');
  if (hint) hint.textContent = 'Buscando...';

  try {
    var response = await fetch('/admin/recursos/isbn/' + encodeURIComponent(input.value.trim()));
    var data = await response.json();

    if (!data || !Object.keys(data).length) {
      if (hint) hint.textContent = 'No se encontró información para ese ISBN.';
      return;
    }

    function fillInput(name, value) {
      var el = document.querySelector('[name="' + name + '"]');
      if (el && value) el.value = value;
    }

    fillInput('titulo', data.title);
    fillInput('editorial', Array.isArray(data.publishers) ? data.publishers[0] : '');
    fillInput('cantidad_paginas', data.number_of_pages);
    if (data.publish_date) {
      var year = (data.publish_date.match(/\d{4}/) || [])[0];
      if (year) fillInput('fecha_publicacion', year + '-01-01');
    }
    if (data.authors && data.authors.length) {
      fillInput('autor', data.authors[0].name || '');
    }

    if (hint) hint.textContent = '✅ Datos completados desde Open Library.';
  } catch (err) {
    if (hint) hint.textContent = 'Error al buscar ISBN. Completa los datos manualmente.';
  }
}

// ── Inicialización ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  syncMaterialOptions();
  syncForm();
  syncLicencia();
  syncSubcategories();
  syncVideoOrigen();
});

// ── Eventos ───────────────────────────────────────────────────────────────
document.addEventListener('change', function(event) {
  var t = event.target;
  if (t.id === 'tipo_contenido')       { syncMaterialOptions(); syncForm(); }
  if (t.id === 'tipo_naturaleza')      { syncForm(); }
  if (t.id === 'licencia-select')      { syncLicencia(); }
  if (t.id === 'categoria-select')     { syncSubcategories(); }
  if (t.id === 'video-origen-select')  { syncVideoOrigen(); }

  // Convertir HH:MM:SS a segundos en tiempo real
  if (t.id === 'duracion-hhmmss') {
    var seg = document.getElementById('duracion-segundos');
    if (seg) seg.value = hhmmssToSegundos(t.value);
  }
});

document.addEventListener('click', function(event) {
  if (event.target.id === 'isbn-search-btn') handleIsbnSearch();
});

// Al enviar el formulario, asegurar que duracion_segundos esté calculado
document.addEventListener('submit', function(event) {
  var hhmmss = document.getElementById('duracion-hhmmss');
  var seg    = document.getElementById('duracion-segundos');
  if (hhmmss && seg && hhmmss.value) {
    seg.value = hhmmssToSegundos(hhmmss.value);
  }
});
