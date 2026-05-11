/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtFecha(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function badgeEstado(estado) {
  if (!estado) return '—';
  const cls = estado.toLowerCase().includes('vencido') ? 'badge-vencido'
            : estado.toLowerCase().includes('activo')  ? 'badge-activo'
            : 'badge-activo';
  return `<span class="${cls}">${estado}</span>`;
}

let chartMateriales = null;
let chartPrestamos  = null;

/* ── Sección 1: Materiales ─────────────────────────────────────────────────── */
async function cargarMateriales() {
  const desde    = document.getElementById('mat-desde').value;
  const hasta    = document.getElementById('mat-hasta').value;
  const tipo     = document.getElementById('mat-tipo').value;

  const params = new URLSearchParams();
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  if (tipo)  params.set('tipo', tipo);

  // Actualizar links de exportar
  const queryStr = params.toString() ? '&' + params.toString() : '';
  document.getElementById('pdf-materiales').href   = `/admin/reportes/exportar/pdf?seccion=materiales${queryStr}`;
  document.getElementById('excel-materiales').href = `/admin/reportes/exportar/excel?seccion=materiales${queryStr}`;

  const tbody = document.querySelector('#tabla-materiales tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading-msg">Cargando…</td></tr>';

  try {
    const resp = await fetch(`/admin/reportes/data/materiales?${params}`);
    const data = await resp.json();

    // Gráfico de barras horizontales
    const ctx = document.getElementById('chartMateriales').getContext('2d');
    if (chartMateriales) chartMateriales.destroy();
    chartMateriales = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.graficoLabels,
        datasets: [{
          label: 'Préstamos',
          data: data.graficoData,
          backgroundColor: '#146c5f',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } },
          y: { ticks: { font: { size: 11 } } }
        }
      }
    });

    // Tabla
    if (!data.recursos.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-msg">Sin datos para este filtro.</td></tr>';
      return;
    }
    tbody.innerHTML = data.recursos.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.titulo}</td>
        <td>${r.autor || '—'}</td>
        <td>${r.categorias?.categoria_nombre || '—'}</td>
        <td><span class="${r.tipo_naturaleza === 'Digital' ? 'badge-digital' : 'badge-fisico'}">${r.tipo_naturaleza}</span></td>
        <td>${r.total_prestamos}</td>
        <td>${r.total_reservas}</td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading-msg" style="color:var(--color-danger)">Error al cargar datos.</td></tr>`;
  }
}

/* ── Sección 2: Préstamos activos ─────────────────────────────────────────── */
async function cargarPrestamos() {
  document.getElementById('pdf-prestamos').href   = '/admin/reportes/exportar/pdf?seccion=prestamos';
  document.getElementById('excel-prestamos').href = '/admin/reportes/exportar/excel?seccion=prestamos';

  const tbody = document.querySelector('#tabla-prestamos tbody');
  tbody.innerHTML = '<tr><td colspan="8" class="loading-msg">Cargando…</td></tr>';

  try {
    const resp = await fetch('/admin/reportes/data/prestamos');
    const data = await resp.json();

    // Gráfico dona
    const ctx = document.getElementById('chartPrestamos').getContext('2d');
    if (chartPrestamos) chartPrestamos.destroy();
    chartPrestamos = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Físicos', 'Digitales'],
        datasets: [{
          data: [data.grafico.fisicos, data.grafico.digitales],
          backgroundColor: ['#146c5f', '#0369a1'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });

    if (!data.filas.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="loading-msg">No hay préstamos activos.</td></tr>';
      return;
    }
    tbody.innerHTML = data.filas.map(f => `
      <tr>
        <td>${f.usuario}</td>
        <td>${f.documento}</td>
        <td>${f.recurso}</td>
        <td>${fmtFecha(f.fecha_inicio)}</td>
        <td>${fmtFecha(f.fecha_limite)}</td>
        <td>${badgeEstado(f.estado)}</td>
        <td style="text-align:center;${f.dias_restantes < 0 ? 'color:var(--color-danger);font-weight:700' : ''}">${f.dias_restantes}</td>
        <td><span class="${f.tipo === 'Digital' ? 'badge-digital' : 'badge-fisico'}">${f.tipo}</span></td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" class="loading-msg" style="color:var(--color-danger)">Error al cargar datos.</td></tr>`;
  }
}

/* ── Sección 3: Morosos ───────────────────────────────────────────────────── */
async function cargarMorosos() {
  document.getElementById('pdf-morosos').href   = '/admin/reportes/exportar/pdf?seccion=morosos';
  document.getElementById('excel-morosos').href = '/admin/reportes/exportar/excel?seccion=morosos';

  const tbody = document.querySelector('#tabla-morosos tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-msg">Cargando…</td></tr>';

  try {
    const resp = await fetch('/admin/reportes/data/morosos');
    const datos = await resp.json();

    if (!datos.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-msg">Sin usuarios morosos activos. 🎉</td></tr>';
      return;
    }
    tbody.innerHTML = datos.map(d => `
      <tr>
        <td>${d.usuario}</td>
        <td>${d.documento}</td>
        <td>${d.recurso}</td>
        <td>${d.tipo_incidencia}</td>
        <td>${d.tipo_sancion}</td>
        <td><span class="badge-vencido">${d.estado}</span></td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading-msg" style="color:var(--color-danger)">Error al cargar datos.</td></tr>`;
  }
}

/* ── Init ─────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  cargarMateriales();
  cargarPrestamos();
  cargarMorosos();
});
