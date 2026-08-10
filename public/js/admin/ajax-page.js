/**
 * Interceptor genérico de ajax para el panel admin.
 *
 * Contrato (ver responder.js en el backend):
 * - Un <form data-ajax method="get"> es un FILTRO: se refresca el
 *   contenedor indicado en data-ajax-list (propio o del ancestro
 *   más cercano con ese atributo) sin recargar la página.
 * - Un <form data-ajax method="post"> es una ACCIÓN: se envía por
 *   fetch, el servidor responde JSON { success, message, redirectTo? }.
 *   Si redirectTo viene, se navega de página completa (la acción
 *   "cambia de sección", p. ej. procesar una reserva). Si no, se
 *   muestra el mensaje como aviso y, si el form trae
 *   data-ajax-refresh, se refresca ese contenedor.
 * - Un <a data-ajax> o <a class="page-btn"> dentro de un contenedor
 *   con data-ajax-list es paginación: se navega por fetch igual
 *   que el filtro.
 * - Un <select data-ajax-nav> (selector de "por página") navega a
 *   la URL de la opción elegida, también por fetch.
 *
 * Si algo falla (red, servidor sin JS-branch, etc.) todo cae de
 * vuelta a la navegación normal del navegador: nada queda "muerto".
 */
(function () {
  function headers(extra) {
    return Object.assign({ 'X-Requested-With': 'fetch' }, extra || {});
  }

  function resolveListTarget(el) {
    var propio = el.getAttribute('data-ajax-list');
    if (propio) return propio;
    var ancestro = el.closest('[data-ajax-list]');
    return ancestro ? ancestro.getAttribute('data-ajax-list') : null;
  }

  function mostrarAviso(tipo, mensaje) {
    if (!mensaje) return;
    var contenedor = document.getElementById('ajax-toasts');
    if (!contenedor) {
      contenedor = document.createElement('div');
      contenedor.id = 'ajax-toasts';
      document.body.appendChild(contenedor);
    }
    var toast = document.createElement('div');
    toast.className = 'ajax-toast ajax-toast--' + (tipo === 'error' ? 'error' : 'success');
    toast.textContent = mensaje;
    contenedor.appendChild(toast);
    setTimeout(function () {
      toast.classList.add('is-leaving');
      setTimeout(function () { toast.remove(); }, 200);
    }, 3200);
  }

  function refrescarLista(selector, url) {
    var destino = selector && document.querySelector(selector);
    if (!destino) return;

    fetch(url, { headers: headers() })
      .then(function (r) {
        if (!r.ok) throw new Error('respuesta no válida');
        return r.text();
      })
      .then(function (html) {
        destino.classList.remove('is-split');
        destino.innerHTML = html;
      })
      .catch(function () {
        window.location.href = url;
      });
  }

  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[data-ajax]');
    if (!form) return;

    var metodo = (form.getAttribute('method') || 'get').toLowerCase();
    var accion = form.getAttribute('action') || window.location.pathname;

    if (metodo === 'get') {
      // Filtro: navegamos por fetch, sin recargar todo.
      e.preventDefault();
      var params = new URLSearchParams(new FormData(form));
      var url = accion + (params.toString() ? '?' + params.toString() : '');
      var listSel = resolveListTarget(form);
      history.pushState(null, '', url);
      refrescarLista(listSel, url);
      return;
    }

    // Acción (POST): la enviamos por fetch y esperamos JSON.
    e.preventDefault();
    var boton = form.querySelector('button[type="submit"]');
    if (boton) boton.disabled = true;

    var body = new URLSearchParams(new FormData(form));

    fetch(accion, { method: 'POST', headers: headers(), body: body })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          return { status: r.status, data: data };
        });
      })
      .then(function (res) {
        var data = res.data || {};

        if (data.redirectTo) {
          // La acción cambia de sección de verdad (ej: préstamo generado).
          window.location.href = data.redirectTo;
          return;
        }

        mostrarAviso(data.success ? 'success' : 'error', data.message);

        var refreshSel = form.getAttribute('data-ajax-refresh');
        if (data.success && refreshSel) {
          refrescarLista(refreshSel, window.location.href);
        }
      })
      .catch(function () {
        // Si el fetch falla de plano, dejamos que el form navegue normal.
        form.removeAttribute('data-ajax');
        form.submit();
      })
      .finally(function () {
        if (boton) boton.disabled = false;
      });
  });

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[data-ajax], a.page-btn');
    if (!link) return;
    if (link.classList.contains('is-disabled')) return;

    var href = link.getAttribute('href');
    if (!href || href === '#') return;

    var listSel = resolveListTarget(link);
    if (!listSel) return; // no está dentro de una zona ajax: navegación normal

    e.preventDefault();
    history.pushState(null, '', href);
    refrescarLista(listSel, href);
  });

  document.addEventListener('change', function (e) {
    var select = e.target.closest('select[data-ajax-nav]');
    if (!select) return;

    var url = select.value;
    if (!url) return;

    var listSel = resolveListTarget(select);
    if (!listSel) {
      window.location.href = url;
      return;
    }

    history.pushState(null, '', url);
    refrescarLista(listSel, url);
  });

  // Botón "atrás/adelante" del navegador: recargamos completo para
  // no complicar el manejo de estado parcial (simple y confiable).
  window.addEventListener('popstate', function () {
    window.location.reload();
  });
})();
