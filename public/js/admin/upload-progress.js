/**
 * upload-progress.js
 * ──────────────────
 * Incluir este script en las vistas: nuevo.ejs / editar.ejs
 * Requiere que el formulario tenga:
 *   - #archivo-input         → <input type="file" name="archivo" ...>
 *   - #titulo-input          → <input type="text"  name="titulo" ...>
 *   - #archivo-url-hidden    → <input type="hidden" name="archivo_url">
 *   - #archivo-tipo-hidden   → <input type="hidden" name="archivo_tipo">
 *   - #archivo-pubid-hidden  → <input type="hidden" name="archivo_public_id">
 *   - #upload-progress-wrap  → contenedor de la barra (inicialmente oculto)
 *   - #upload-progress-bar   → <div> o <progress> de la barra
 *   - #upload-status-text    → <span> con el texto de estado
 *   - #btn-guardar           → botón submit del formulario
 */

(function () {
  const archivoInput = document.getElementById('archivo-input');
  if (!archivoInput) return;

  const tituloInput   = document.getElementById('titulo-input');
  const urlHidden     = document.getElementById('archivo-url-hidden');
  const tipoHidden    = document.getElementById('archivo-tipo-hidden');
  const pubidHidden   = document.getElementById('archivo-pubid-hidden');
  const progressWrap  = document.getElementById('upload-progress-wrap');
  const progressBar   = document.getElementById('upload-progress-bar');
  const statusText    = document.getElementById('upload-status-text');
  const btnGuardar    = document.getElementById('btn-guardar');

  // Formatos grandes que necesitan feedback visual
  const VIDEO_EXTS = ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', 'wmv'];
  const AUDIO_EXTS = ['mp3', 'wav', 'm4b', 'm4a', 'ogg', 'aac', 'flac'];

  function getExt(filename) {
    return filename.split('.').pop().toLowerCase();
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function setProgress(pct) {
    if (progressBar.tagName === 'PROGRESS') {
      progressBar.value = pct;
    } else {
      progressBar.style.width = pct + '%';
    }
  }

  archivoInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;

    const ext = getExt(file.name);
    const esMedioGrande = VIDEO_EXTS.includes(ext) || AUDIO_EXTS.includes(ext) || file.size > 10 * 1024 * 1024;

    if (!esMedioGrande) return; // Archivos pequeños se suben con el formulario normal

    // ── Subida anticipada con barra de progreso ──────────────────────────────
    const titulo = tituloInput ? tituloInput.value.trim() : 'recurso';

    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('titulo', titulo);

    progressWrap.style.display = 'block';
    setProgress(0);
    statusText.textContent = `Subiendo ${file.name} (${formatBytes(file.size)})…`;
    if (btnGuardar) btnGuardar.disabled = true;

    const xhr = new XMLHttpRequest();

    // Progreso real de la subida al servidor
    xhr.upload.addEventListener('progress', function (e) {
      if (!e.lengthComputable) return;
      const serverPct = Math.round((e.loaded / e.total) * 70); // 0-70% → al servidor
      setProgress(serverPct);
      statusText.textContent =
        `Enviando al servidor: ${serverPct}% (${formatBytes(e.loaded)} / ${formatBytes(e.total)})`;
    });

    // Cuando termina la transferencia al servidor, Cloudinary procesa (restante 30%)
    xhr.upload.addEventListener('load', function () {
      setProgress(75);
      statusText.textContent = 'Procesando en Cloudinary…';
    });

    xhr.addEventListener('load', function () {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          urlHidden.value   = data.url;
          tipoHidden.value  = data.ext;
          pubidHidden.value = data.public_id;

          setProgress(100);
          statusText.textContent = `✓ Archivo listo (${formatBytes(data.tamano_bytes)})`;
          progressBar.classList.add('bg-success');

          // Limpiar el input para que el formulario no lo suba de nuevo
          archivoInput.value = '';

        } catch (err) {
          statusText.textContent = '✗ Error procesando la respuesta del servidor.';
          progressBar.classList.add('bg-danger');
        }
      } else {
        let msg = 'Error al subir el archivo.';
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch (_) {}
        statusText.textContent = `✗ ${msg}`;
        progressBar.classList.add('bg-danger');
      }

      if (btnGuardar) btnGuardar.disabled = false;
    });

    xhr.addEventListener('error', function () {
      statusText.textContent = '✗ Error de red al subir el archivo.';
      progressBar.classList.add('bg-danger');
      if (btnGuardar) btnGuardar.disabled = false;
    });

    xhr.open('POST', '/admin/recursos/subir-archivo');
    xhr.send(formData);
  });
})();
