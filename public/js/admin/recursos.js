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
    if (audio)        labelAutor.textContent = 'Autor / Creador del libro original';
    else if (video)   labelAutor.textContent = 'Director / Creador';
    else              labelAutor.textContent = 'Autor / Creador';
  }

  // Label imagen
  var labelImagen = document.getElementById('label-imagen');
  if (labelImagen) {
    if (audio)        labelImagen.textContent = 'Carátula del audiolibro';
    else if (video)   labelImagen.textContent = 'Thumbnail / miniatura';
    else              labelImagen.textContent = 'Imagen de portada';
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

function initCloudinaryUploadWidget(buttonId, statusId, previewId, urlFieldId, tipoFieldId, publicIdFieldId, allowedFormats, label) {
  var button = document.getElementById(buttonId);
  var status = document.getElementById(statusId);
  var preview = document.getElementById(previewId);
  if (!button) return;

  if (!window.cloudinary || typeof window.cloudinary.createUploadWidget !== 'function') {
    button.disabled = true;
    if (status) status.textContent = 'Cloudinary no está disponible en este momento.';
    return;
  }

  if (!window.CLOUDINARY_CLOUD_NAME) {
    button.disabled = true;
    if (status) status.textContent = 'Cloudinary cloud name no configurado. Defina CLOUDINARY_CLOUD_NAME en .env.';
    return;
  }

  if (!window.CLOUDINARY_UPLOAD_PRESET) {
    button.disabled = true;
    if (status) status.textContent = 'Upload preset no configurado. Defina CLOUDINARY_UPLOAD_PRESET en .env.';
    return;
  }

  var widget = window.cloudinary.createUploadWidget({
    cloudName: window.CLOUDINARY_CLOUD_NAME,
    uploadPreset: window.CLOUDINARY_UPLOAD_PRESET,
    multiple: false,
    maxFiles: 1,
    resourceType: 'auto',
    clientAllowedFormats: allowedFormats,
    sources: ['local', 'url', 'camera', 'image_search', 'google_drive', 'dropbox'],
    showCompletedButton: true
  }, function(error, result) {
    if (error) {
      if (status) status.textContent = 'Error de Cloudinary: ' + (error.message || 'falló la carga');
      return;
    }

    if (result.event === 'success') {
      var info = result.info || {};
      if (urlFieldId) document.getElementById(urlFieldId).value = info.secure_url || info.url || '';
      if (tipoFieldId) document.getElementById(tipoFieldId).value = info.format || '';
      if (publicIdFieldId) document.getElementById(publicIdFieldId).value = info.public_id || '';
      if (status) status.textContent = 'Archivo cargado correctamente.';
      if (preview) preview.innerHTML = '✓ ' + label + ' cargado: <a href="' + (info.secure_url || info.url || '#') + '" target="_blank">' + (info.original_filename || info.public_id || 'Ver archivo') + '</a>';
    }
  });

  button.addEventListener('click', function() {
    widget.open();
  });
}

// ─────────────────────────────────────────────────────────────────────────
// FIX: Deshabilitar campos de secciones OCULTAS antes de enviar el formulario
// ─────────────────────────────────────────────────────────────────────────
// El bug era: display:none NO evita que el navegador incluya los campos en el
// POST. Cuando se seleccionaba Video+URL, llegaban DOS valores para
// "archivo_tipo" (el del select de Lectura + el hidden de video-url-block),
// y Express los concatenaba como "pdf,url", que Mongoose rechazaba.
//
// Solución: antes del submit, deshabilitamos todos los campos dentro de
// secciones no visibles. El atributo `disabled` sí impide que se envíen.
// ─────────────────────────────────────────────────────────────────────────

function deshabilitarCamposOcultos() {
  // Primero habilitamos TODO para partir de estado limpio
  document.querySelectorAll('input, select, textarea').forEach(function(el) {
    el.disabled = false;
  });

  var contenido  = val('tipo_contenido');
  var naturaleza = val('tipo_naturaleza');

  // Bloques que NO corresponden al tipo de contenido activo
  var bloquesInactivos = [];

  if (contenido !== 'Lectura') bloquesInactivos.push('archivo-lectura-block');
  if (contenido !== 'Audio')   bloquesInactivos.push('archivo-audio-block');
  if (contenido !== 'Video')   bloquesInactivos.push('archivo-video-block');

  // Dentro del bloque de video, solo uno de los dos sub-bloques está activo
  if (contenido === 'Video') {
    var origenSel = document.getElementById('video-origen-select');
    if (origenSel) {
      if (origenSel.value === 'url') {
        bloquesInactivos.push('video-archivo-block');
      } else {
        bloquesInactivos.push('video-url-block');
      }
    }
  }

  // Sección digital completa si no aplica
  if (naturaleza === 'Físico') bloquesInactivos.push('digital-section');
  // Sección física completa si no aplica
  if (naturaleza === 'Digital') bloquesInactivos.push('physical-section');
  // Licencia restringida si está oculta
  var licSel = document.getElementById('licencia-select');
  if (licSel && licSel.value !== 'Restringida') bloquesInactivos.push('licencia-restringida-block');

  bloquesInactivos.forEach(function(id) {
    var bloque = document.getElementById(id);
    if (!bloque) return;
    bloque.querySelectorAll('input, select, textarea').forEach(function(el) {
      el.disabled = true;
    });
  });
}

// ── Inicialización ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  syncMaterialOptions();
  syncForm();
  syncLicencia();
  syncSubcategories();
  syncVideoOrigen();

  initCloudinaryUploadWidget(
    'audio-upload-btn',
    'audio-upload-status',
    'audio-upload-preview',
    'audio-cloudinary-url',
    'audio-cloudinary-tipo',
    'audio-cloudinary-pubid',
    ['mp3', 'wav', 'm4b', 'aac', 'ogg', 'flac'],
    'Audio'
  );

  initCloudinaryUploadWidget(
    'video-upload-btn',
    'video-upload-status',
    'video-upload-preview',
    'video-cloudinary-url',
    'video-cloudinary-tipo',
    'video-cloudinary-pubid',
    ['mp4', 'webm', 'avi', 'mov', 'mkv'],
    'Video'
  );
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

// Al enviar el formulario:
// 1. Calcular duracion_segundos desde HH:MM:SS
// 2. Deshabilitar campos ocultos para evitar envío de valores duplicados (FIX)
document.addEventListener('submit', function() {
  var hhmmss = document.getElementById('duracion-hhmmss');
  var seg    = document.getElementById('duracion-segundos');
  if (hhmmss && seg && hhmmss.value) {
    seg.value = hhmmssToSegundos(hhmmss.value);
  }

  deshabilitarCamposOcultos(); // ← FIX principal: evita "pdf,url" y valores duplicados
});
