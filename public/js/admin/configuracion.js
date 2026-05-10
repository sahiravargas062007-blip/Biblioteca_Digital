document.addEventListener('change', (event) => {
  if (!event.target.matches('[data-toggle-target]')) return;
  const target = document.querySelector(event.target.dataset.toggleTarget);
  if (target) target.hidden = !event.target.checked;
});
