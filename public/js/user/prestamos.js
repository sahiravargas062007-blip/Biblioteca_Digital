function iniciarCuentaRegresiva() {
  document.querySelectorAll('[data-deadline]').forEach((node) => {
    const deadline = new Date(node.dataset.deadline).getTime();
    const diff = Math.max(0, deadline - Date.now());
    const hours = Math.floor(diff / 36e5);
    node.textContent = `${hours} horas restantes`;
  });
}

setInterval(iniciarCuentaRegresiva, 60000);
document.addEventListener('DOMContentLoaded', iniciarCuentaRegresiva);
