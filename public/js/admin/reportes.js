document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('reportChart');
  if (!canvas || !window.Chart) return;
  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Fisicos', 'Digitales'],
      datasets: [{ data: [0, 0] }]
    }
  });
});
