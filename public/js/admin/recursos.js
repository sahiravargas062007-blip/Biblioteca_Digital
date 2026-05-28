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

// ── Esquemas de metadatos dinámicos para Lectura ─────────────────────────
var METADATOS_SCHEMAS = {
  "Libro": [
    { name: "editorial", label: "Editorial", type: "text", required: true, icon: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>' },
    { name: "paginas", label: "Páginas", type: "number", required: true, min: 1, icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
    { name: "isbn", label: "ISBN", type: "text", required: false, icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>' }
  ],
  "Revista": [
    { name: "volumen", label: "Volumen", type: "number", required: true, min: 1, icon: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>' },
    { name: "numero", label: "Número", type: "number", required: true, min: 1, icon: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>' },
    { name: "issn", label: "ISSN", type: "text", required: false, icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>' }
  ],
  "Artículo": [
    { name: "revista", label: "Revista / Diario", type: "text", required: true, icon: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>' },
    { name: "doi", label: "DOI", type: "text", required: false, icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>' },
    { name: "volumen", label: "Volumen", type: "number", required: false, min: 1, icon: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>' }
  ],
  "Tesis": [
    { name: "universidad", label: "Universidad", type: "text", required: true, icon: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/>' },
    { name: "programa", label: "Programa Académico", type: "text", required: true, icon: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>' },
    { name: "tipo_tesis", label: "Tipo de Tesis", type: "select", options: ["Pregrado", "Maestría", "Doctorado"], required: true, icon: '<circle cx="12" cy="7" r="4"/><path d="M5.5 21l3-12h7l3 12z"/>' },
    { name: "director", label: "Director / Tutor", type: "text", required: false, icon: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>' }
  ],
  "Ley y Normativa": [
    { name: "numero_norma", label: "Número de Norma", type: "text", required: true, icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>' },
    { name: "entidad_emisora", label: "Entidad Emisora", type: "text", required: true, icon: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
    { name: "diario_oficial", label: "Diario Oficial (Publicación)", type: "text", required: false, icon: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>' }
  ],
  "Mapa": [
    { name: "escala", label: "Escala", type: "text", placeholder: "e.g., 1:50000", required: true, icon: '<line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>' },
    { name: "region", label: "Región Geográfica", type: "text", required: true, icon: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>' },
    { name: "proyeccion", label: "Proyección Cartográfica", type: "text", placeholder: "e.g., Mercator", required: false, icon: '<circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/><line x1="2" y1="12" x2="22" y2="12"/>' },
    { name: "año_cartografico", label: "Año Cartográfico", type: "number", required: false, min: 1, icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' }
  ]
};

// Renderiza dinámicamente el conjunto de inputs según tipo de material de Lectura
function renderMetadatosDinamicos() {
  var container = document.getElementById('metadatos-dinamicos-container');
  if (!container) return;

  var content = val('tipo_contenido');
  var material = val('tipo_material');

  // Solo para Lectura y si el material tiene esquema
  if (content !== 'Lectura' || !METADATOS_SCHEMAS[material]) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = '';

  var fields = METADATOS_SCHEMAS[material];
  var existing = window.RECURSO_METADATOS || {};

  var html = '<div class="af-grid-3" style="margin-top:14px">';

  fields.forEach(function(field) {
    var value = existing[field.name] !== undefined && existing[field.name] !== null ? existing[field.name] : '';
    var reqAttr = field.required ? ' required' : '';
    var placeholder = field.placeholder ? ' placeholder="' + field.placeholder + '"' : '';
    var minAttr = field.min !== undefined ? ' min="' + field.min + '"' : '';

    var inputHtml = '';
    if (field.type === 'select') {
      var optionsHtml = (field.options || []).map(function(opt) {
        return '<option value="' + opt + '"' + (String(opt) === String(value) ? ' selected' : '') + '>' + opt + '</option>';
      }).join('');
      inputHtml = '<select name="metadatos[' + field.name + ']" id="meta-' + field.name + '"' + reqAttr + '>' +
                    '<option value="">Seleccione</option>' + optionsHtml +
                  '</select>';
    } else {
      inputHtml = '<input type="' + field.type + '" name="metadatos[' + field.name + ']" id="meta-' + field.name + '" value="' + value + '"' + placeholder + reqAttr + minAttr + '>';
    }

    html += '<label class="af-label">' +
              '<span>' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">' + field.icon + '</svg>' +
                field.label + (field.required ? ' *' : '') +
              '</span>' +
              inputHtml +
            '</label>';
  });

  html += '</div>';
  container.innerHTML = html;
}

// Sincroniza la fila de autocompletar (ISBN para Libro, DOI para Artículo, oculto para otros)
function syncAutocompletarRow() {
  var row = document.getElementById('isbn-row');
  if (!row) return;

  var content = val('tipo_contenido');
  var material = val('tipo_material');

  if (content === 'Lectura' && (material === 'Libro' || material === 'Artículo')) {
    row.style.display = '';

    var cardLabel = row.querySelector('.af-card__label');
    var inputSpan = row.querySelector('.af-label span');
    var inputEl = document.getElementById('isbn-input');
    var btn = document.getElementById('isbn-search-btn');

    if (material === 'Libro') {
      if (cardLabel) cardLabel.innerHTML = 'ISBN (opcional — autocompleta metadatos)';
      if (inputSpan) {
        inputSpan.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> ISBN';
      }
      if (inputEl) {
        inputEl.placeholder = '978-...';
        if (!inputEl.value && window.RECURSO_METADATOS && window.RECURSO_METADATOS.isbn) {
          inputEl.value = window.RECURSO_METADATOS.isbn;
        }
      }
      if (btn) {
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Buscar ISBN';
      }
    } else if (material === 'Artículo') {
      if (cardLabel) cardLabel.innerHTML = 'DOI (opcional — autocompleta metadatos)';
      if (inputSpan) {
        inputSpan.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> DOI';
      }
      if (inputEl) {
        inputEl.placeholder = 'e.g., 10.1000/xyz123';
        if ((!inputEl.value || inputEl.value.includes('-')) && window.RECURSO_METADATOS && window.RECURSO_METADATOS.doi) {
          inputEl.value = window.RECURSO_METADATOS.doi;
        }
      }
      if (btn) {
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Buscar DOI';
      }
    }
  } else {
    row.style.display = 'none';
  }
}

// ── Mostrar / ocultar secciones según tipo de contenido y naturaleza ──────
function syncForm() {
  var contenido  = val('tipo_contenido');
  var naturaleza = val('tipo_naturaleza');

  // Sección digital
  var showDigital = naturaleza === 'Digital' || naturaleza === 'Mixto';
  var digitalSection = document.getElementById('digital-section') || document.getElementById('panel-digital');
  if (digitalSection) digitalSection.style.display = showDigital ? '' : 'none';

  // Sección física
  var showFisico = naturaleza === 'Físico' || naturaleza === 'Mixto';
  var physicalSection = document.getElementById('physical-section') || document.getElementById('panel-fisica');
  if (physicalSection) physicalSection.style.display = showFisico ? '' : 'none';

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

  // ISBN: visible en Lectura y Audio (pero para Lectura lo delegamos a syncAutocompletarRow)
  if (contenido === 'Audio') {
    var isbnRow = document.getElementById('isbn-row');
    if (isbnRow) {
      isbnRow.style.display = '';
      var cardLabel = isbnRow.querySelector('.af-card__label');
      var inputSpan = isbnRow.querySelector('.af-label span');
      var inputEl = document.getElementById('isbn-input');
      var btn = document.getElementById('isbn-search-btn');
      if (cardLabel) cardLabel.innerHTML = 'ISBN (opcional — autocompleta metadatos)';
      if (inputSpan) {
        inputSpan.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> ISBN';
      }
      if (inputEl) inputEl.placeholder = '978-...';
      if (btn) {
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Buscar ISBN';
      }
    }
  } else if (contenido === 'Video') {
    hide('isbn-row');
  } else {
    syncAutocompletarRow();
  }

  // Páginas estático: siempre oculto para Lectura (que usa dinámico en Libro), y oculto para los demás
  var paginasWrap = document.getElementById('paginas-wrap');
  if (paginasWrap) paginasWrap.style.display = 'none';

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

  // Editorial estático: visible solo en Audio
  var editorialWrap = document.getElementById('label-editorial-wrap');
  if (editorialWrap) {
    editorialWrap.style.display = (contenido === 'Audio') ? '' : 'none';
  }
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

// ── Búsqueda ISBN (Open Library) ──────────────────────────────────────────
async function handleIsbnSearch() {
  var input = document.getElementById('isbn-input');
  if (!input || !input.value.trim()) return;

  var hint = document.getElementById('isbn-hint');
  if (hint) hint.textContent = 'Buscando libro en Open Library...';

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

    function fillMetaInput(name, value) {
      var el = document.getElementById('meta-' + name);
      if (el && value) el.value = value;
    }

    fillInput('titulo', data.title);
    
    var editorialVal = Array.isArray(data.publishers) ? data.publishers[0] : (data.publishers || '');
    fillInput('editorial', editorialVal);
    fillMetaInput('editorial', editorialVal);

    fillInput('cantidad_paginas', data.number_of_pages);
    fillMetaInput('paginas', data.number_of_pages);

    fillMetaInput('isbn', input.value.trim());

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

// ── Búsqueda DOI (CrossRef) ────────────────────────────────────────────────
async function handleDoiSearch() {
  var input = document.getElementById('isbn-input');
  if (!input || !input.value.trim()) return;

  var hint = document.getElementById('isbn-hint');
  if (hint) hint.textContent = 'Buscando artículo en CrossRef...';

  try {
    var doi = input.value.trim();
    doi = doi.replace(/^https?:\/\/doi\.org\//i, '');

    var response = await fetch('/admin/recursos/doi/' + encodeURIComponent(doi));
    var data = await response.json();

    if (!data || !Object.keys(data).length) {
      if (hint) hint.textContent = 'No se encontró información para ese DOI.';
      return;
    }

    function fillInput(name, value) {
      var el = document.querySelector('[name="' + name + '"]');
      if (el && value) el.value = value;
    }

    function fillMetaInput(name, value) {
      var el = document.getElementById('meta-' + name);
      if (el && value) el.value = value;
    }

    fillInput('titulo', data.title);
    fillInput('autor', data.autor);
    if (data.fecha_publicacion) {
      fillInput('fecha_publicacion', data.fecha_publicacion);
    }

    fillMetaInput('revista', data.revista);
    fillMetaInput('volumen', data.volumen);
    fillMetaInput('doi', doi);

    if (hint) hint.textContent = '✅ Datos completados desde CrossRef API.';
  } catch (err) {
    if (hint) hint.textContent = 'Error al buscar DOI. Completa los datos manualmente.';
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

// ── FIX: Deshabilitar campos de secciones OCULTAS antes de enviar el formulario ──
function deshabilitarCamposOcultos() {
  document.querySelectorAll('input, select, textarea').forEach(function(el) {
    el.disabled = false;
  });

  var contenido  = val('tipo_contenido');
  var naturaleza = val('tipo_naturaleza');

  var bloquesInactivos = [];

  if (contenido !== 'Lectura') {
    bloquesInactivos.push('archivo-lectura-block');
    bloquesInactivos.push('metadatos-dinamicos-container');
  }
  if (contenido !== 'Audio')   bloquesInactivos.push('archivo-audio-block');
  if (contenido !== 'Video')   bloquesInactivos.push('archivo-video-block');

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

  if (naturaleza === 'Físico') bloquesInactivos.push(document.getElementById('digital-section') ? 'digital-section' : 'panel-digital');
  if (naturaleza === 'Digital') bloquesInactivos.push(document.getElementById('physical-section') ? 'physical-section' : 'panel-fisica');
  
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
  renderMetadatosDinamicos();
  syncAutocompletarRow();

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
  if (t.id === 'tipo_contenido')       { syncMaterialOptions(); syncForm(); renderMetadatosDinamicos(); syncAutocompletarRow(); }
  if (t.id === 'tipo_material')        { renderMetadatosDinamicos(); syncAutocompletarRow(); }
  if (t.id === 'tipo_naturaleza')      { syncForm(); }
  if (t.id === 'licencia-select')      { syncLicencia(); }
  if (t.id === 'categoria-select')     { syncSubcategories(); }
  if (t.id === 'video-origen-select')  { syncVideoOrigen(); }

  if (t.id === 'duracion-hhmmss') {
    var seg = document.getElementById('duracion-segundos');
    if (seg) seg.value = hhmmssToSegundos(t.value);
  }
});

document.addEventListener('click', function(event) {
  var t = event.target;
  var btn = t.closest('#isbn-search-btn');
  if (btn) {
    var material = val('tipo_material');
    if (material === 'Libro') {
      handleIsbnSearch();
    } else if (material === 'Artículo') {
      handleDoiSearch();
    }
  }
});

document.addEventListener('submit', function() {
  var hhmmss = document.getElementById('duracion-hhmmss');
  var seg    = document.getElementById('duracion-segundos');
  if (hhmmss && seg && hhmmss.value) {
    seg.value = hhmmssToSegundos(hhmmss.value);
  }

  deshabilitarCamposOcultos();
});
