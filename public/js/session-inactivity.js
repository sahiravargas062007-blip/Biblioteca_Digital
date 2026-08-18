(() => {
  const timeoutMs = 15 * 60 * 1000;
  const heartbeatIntervalMs = 60 * 1000;
  let lastActivityAt = Date.now();
  let lastHeartbeatAt = 0;
  let expirationTimer;

  const redirectToLogin = () => window.location.replace('/login?expirada=1');

  const scheduleExpiration = () => {
    window.clearTimeout(expirationTimer);
    expirationTimer = window.setTimeout(redirectToLogin, timeoutMs);
  };

  const renewOnServer = () => {
    if (Date.now() - lastHeartbeatAt < heartbeatIntervalMs) return;
    lastHeartbeatAt = Date.now();

    fetch('/sesion/actividad', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    }).then((response) => {
      if (response.status === 401) redirectToLogin();
    }).catch(() => {
      // Un fallo temporal de red no debe cerrar una sesión localmente.
    });
  };

  const registerActivity = () => {
    const now = Date.now();
    if (now - lastActivityAt < 1000) return;
    lastActivityAt = now;
    scheduleExpiration();
    renewOnServer();
  };

  ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'].forEach((eventName) => {
    window.addEventListener(eventName, registerActivity, { passive: true });
  });

  scheduleExpiration();
})();
