const Recurso   = require('../models/Recurso');
const Prestamo  = require('../models/Prestamo');
const Sancion   = require('../models/Sancion');
const Usuario   = require('../models/Usuario');

/* ── Tarjetas resumen ───────────────────────────────────────────────────────── */
exports.resumen = async () => {
  const hoy     = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const [
    totalRecursos,
    prestamosActivos,
    usuariosSancionados,
    recursoMesPipeline
  ] = await Promise.all([
    Recurso.countDocuments({ estado: 'Activo' }),
    Prestamo.countDocuments({ estado: { $in: ['Activo', 'Parcialmente devuelto', 'Vencido'] } }),
    Sancion.distinct('usuario_id', { estado: 'Activa' }),
    Recurso.aggregate([
      { $match: { estado: 'Activo' } },
      { $sort:  { total_prestamos: -1 } },
      { $limit: 1 },
      { $project: { _id: 0, titulo: 1, total_prestamos: 1 } }
    ])
  ]);

  return {
    totalRecursos,
    prestamosActivos,
    usuariosSancionados: usuariosSancionados.length,
    recursoMasSolicitado: recursoMesPipeline[0] || null
  };
};

/* ── Materiales más consultados ─────────────────────────────────────────────── */
exports.materialesConsultados = async ({ desde, hasta, categoria, tipo } = {}) => {
  const match = { estado: 'Activo' };

  if (categoria) match['categorias.categoria_id'] = categoria;
  if (tipo)      match.tipo_naturaleza = tipo;

  const recursos = await Recurso.aggregate([
    { $match: match },
    { $sort:  { total_prestamos: -1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 1,
        titulo: 1,
        autor: 1,
        tipo_naturaleza: 1,
        tipo_contenido: 1,
        categorias: { $arrayElemAt: ['$categorias', 0] },
        total_prestamos: 1,
        total_reservas: 1
      }
    }
  ]);

  const graficoLabels = recursos.map(r => r.titulo.length > 30 ? r.titulo.slice(0, 28) + '…' : r.titulo);
  const graficoData   = recursos.map(r => r.total_prestamos);

  return { recursos, graficoLabels, graficoData };
};

/* ── Préstamos activos ──────────────────────────────────────────────────────── */
exports.prestamosActivos = async () => {
  const prestamos = await Prestamo.find({
    estado: { $in: ['Activo', 'Parcialmente devuelto', 'Vencido'] }
  })
    .sort({ creado_en: -1 })
    .lean();

  let fisicos  = 0;
  let digitales = 0;

  const filas = [];
  for (const p of prestamos) {
    for (const item of p.items || []) {
      const esFisico = !!item.ejemplar_id;
      if (esFisico) fisicos++; else digitales++;

      const ahora = new Date();
      const limite = new Date(item.fecha_limite);
      const diasRestantes = Math.ceil((limite - ahora) / 86400000);

      filas.push({
        usuario:       p.usuario_nombre,
        documento:     p.usuario_documento,
        recurso:       item.recurso_titulo,
        fecha_inicio:  item.fecha_inicio,
        fecha_limite:  item.fecha_limite,
        estado:        item.estado,
        dias_restantes: diasRestantes,
        tipo:          esFisico ? 'Físico' : 'Digital'
      });
    }
  }

  return { filas, grafico: { fisicos, digitales } };
};

/* ── Usuarios morosos ───────────────────────────────────────────────────────── */
exports.usuariosMorosos = async () => {
  const sanciones = await Sancion.find({ estado: 'Activa' })
    .sort({ fecha_inicio: -1 })
    .lean();

  return sanciones.map(s => ({
    usuario:         s.usuario_nombre,
    documento:       s.usuario_documento,
    recurso:         s.recurso_titulo || '—',
    tipo_incidencia: s.tipo_incidencia,
    tipo_sancion:    s.tipo_sancion,
    estado:          s.estado,
    dias_retraso:    s.dias_retraso || 0
  }));
};
