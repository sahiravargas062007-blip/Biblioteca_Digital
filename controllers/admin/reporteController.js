const path    = require('path');
const os      = require('os');
const fs      = require('fs').promises;
const xlsx    = require('xlsx');
const reporteService = require('../../services/reporteService');

/* ── helpers ──────────────────────────────────────────────────────────────── */
function fmtFecha(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ── Página principal ─────────────────────────────────────────────────────── */
exports.index = async (req, res, next) => {
  try {
    const resumen = await reporteService.resumen();
    res.render('admin/reportes/index', {
      title: 'Reportes',
      resumen
    });
  } catch (err) {
    next(err);
  }
};

/* ── Datos JSON para cada sección (llamados por fetch desde el frontend) ───── */
exports.dataMateriales = async (req, res, next) => {
  try {
    const { desde, hasta, categoria, tipo } = req.query;
    const data = await reporteService.materialesConsultados({ desde, hasta, categoria, tipo });
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.dataPrestamos = async (req, res, next) => {
  try {
    const data = await reporteService.prestamosActivos();
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.dataMorosos = async (req, res, next) => {
  try {
    const data = await reporteService.usuariosMorosos();
    res.json(data);
  } catch (err) {
    next(err);
  }
};

/* ── Exportar Excel ───────────────────────────────────────────────────────── */
exports.exportarExcel = async (req, res, next) => {
  try {
    const { seccion, desde, hasta, categoria, tipo } = req.query;
    let filas = [];
    let nombreHoja = 'Reporte';
    let nombreArchivo = 'reporte.xlsx';

    if (seccion === 'materiales') {
      const data = await reporteService.materialesConsultados({ desde, hasta, categoria, tipo });
      nombreHoja   = 'Materiales consultados';
      nombreArchivo = 'materiales_consultados.xlsx';
      filas = data.recursos.map(r => ({
        Título:            r.titulo,
        Autor:             r.autor || '—',
        Categoría:         r.categorias?.categoria_nombre || '—',
        Tipo:              r.tipo_naturaleza,
        'Total préstamos': r.total_prestamos,
        'Total reservas':  r.total_reservas
      }));
    } else if (seccion === 'prestamos') {
      const data = await reporteService.prestamosActivos();
      nombreHoja    = 'Préstamos activos';
      nombreArchivo = 'prestamos_activos.xlsx';
      filas = data.filas.map(f => ({
        Usuario:          f.usuario,
        Documento:        f.documento,
        Recurso:          f.recurso,
        'Fecha inicio':   fmtFecha(f.fecha_inicio),
        'Fecha límite':   fmtFecha(f.fecha_limite),
        Estado:           f.estado,
        'Días restantes': f.dias_restantes,
        Modalidad:        f.tipo
      }));
    } else if (seccion === 'morosos') {
      const datos = await reporteService.usuariosMorosos();
      nombreHoja    = 'Usuarios morosos';
      nombreArchivo = 'usuarios_morosos.xlsx';
      filas = datos.map(d => ({
        Usuario:          d.usuario,
        Documento:        d.documento,
        Recurso:          d.recurso,
        'Tipo incidencia': d.tipo_incidencia,
        'Tipo sanción':   d.tipo_sancion,
        Estado:           d.estado
      }));
    } else {
      return res.status(400).send('Sección no válida.');
    }

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(filas);
    xlsx.utils.book_append_sheet(wb, ws, nombreHoja);

    const tmpPath = path.join(os.tmpdir(), nombreArchivo);
    xlsx.writeFile(wb, tmpPath);

    res.download(tmpPath, nombreArchivo, async () => {
      try { await fs.unlink(tmpPath); } catch (_) {}
    });
  } catch (err) {
    next(err);
  }
};

/* ── Exportar PDF con Puppeteer ───────────────────────────────────────────── */
exports.exportarPdf = async (req, res, next) => {
  try {
    const PDFDocument = require('pdfkit');
    const { seccion, desde, hasta, categoria, tipo } = req.query;

    const resumen = await reporteService.resumen();

    let titulo = 'Reporte';
    let nombreArchivo = 'reporte.pdf';
    let filas = [];
    let columnas = [];

    if (seccion === 'materiales') {
      const data = await reporteService.materialesConsultados({ desde, hasta, categoria, tipo });
      titulo        = 'Materiales más consultados';
      nombreArchivo = 'materiales_consultados.pdf';
      columnas      = ['Título', 'Autor', 'Categoría', 'Tipo', 'Préstamos', 'Reservas'];
      filas = data.recursos.map(r => [
        r.titulo,
        r.autor || '—',
        r.categorias?.categoria_nombre || '—',
        r.tipo_naturaleza,
        String(r.total_prestamos),
        String(r.total_reservas)
      ]);
    } else if (seccion === 'prestamos') {
      const data = await reporteService.prestamosActivos();
      titulo        = 'Préstamos activos';
      nombreArchivo = 'prestamos_activos.pdf';
      columnas      = ['Usuario', 'Documento', 'Recurso', 'Inicio', 'Límite', 'Estado', 'Días', 'Tipo'];
      filas = data.filas.map(f => [
        f.usuario,
        f.documento,
        f.recurso,
        fmtFecha(f.fecha_inicio),
        fmtFecha(f.fecha_limite),
        f.estado,
        String(f.dias_restantes),
        f.tipo
      ]);
    } else if (seccion === 'morosos') {
      const datos = await reporteService.usuariosMorosos();
      titulo        = 'Usuarios con sanciones activas';
      nombreArchivo = 'usuarios_morosos.pdf';
      columnas      = ['Usuario', 'Documento', 'Recurso', 'Incidencia', 'Sanción', 'Estado'];
      filas = datos.map(d => [
        d.usuario,
        d.documento,
        d.recurso,
        d.tipo_incidencia,
        d.tipo_sancion,
        d.estado
      ]);
    } else {
      return res.status(400).send('Sección no válida.');
    }

    // ── Generar PDF con PDFKit ────────────────────────────────────────────
    // PDFKit corre 100% en Node, sin Chromium, funciona en Windows sin problemas
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    doc.pipe(res);

    const COLOR_PRIMARY   = '#146c5f';
    const COLOR_DARK      = '#102c2a';
    const COLOR_MUTED     = '#667085';
    const COLOR_ROW_EVEN  = '#f6f7f9';
    const COLOR_BORDER    = '#e2e8f0';
    const PAGE_WIDTH      = doc.page.width - 80; // margen 40 a cada lado

    // ── Encabezado ────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 70).fill(COLOR_PRIMARY);
    doc.fill('#fff').font('Helvetica-Bold').fontSize(16)
       .text('Biblioteca Digital SENA', 40, 18);
    doc.fill('#fff').font('Helvetica').fontSize(11)
       .text(titulo, 40, 38);
    doc.fill(COLOR_MUTED).fontSize(9)
       .text(`Generado el ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}`, 40, 55);

    let y = 90;

    // ── Tarjetas resumen ──────────────────────────────────────────────────
    const cardW = PAGE_WIDTH / 4 - 6;
    const cards = [
      { label: 'Total recursos',      value: String(resumen.totalRecursos) },
      { label: 'Préstamos activos',   value: String(resumen.prestamosActivos) },
      { label: 'Sancionados',         value: String(resumen.usuariosSancionados) },
      { label: 'Más solicitado',      value: resumen.recursoMasSolicitado?.titulo || '—' }
    ];
    cards.forEach((card, i) => {
      const x = 40 + i * (cardW + 8);
      doc.rect(x, y, cardW, 44).fill('#fff').stroke(COLOR_BORDER);
      doc.fill(COLOR_MUTED).font('Helvetica').fontSize(7)
         .text(card.label.toUpperCase(), x + 8, y + 6, { width: cardW - 16 });
      const valFontSize = card.value.length > 12 ? 9 : 16;
      doc.fill(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(valFontSize)
         .text(card.value, x + 8, y + 18, { width: cardW - 16 });
    });
    y += 60;

    // ── Título de sección ─────────────────────────────────────────────────
    doc.fill(COLOR_DARK).font('Helvetica-Bold').fontSize(12)
       .text(titulo, 40, y);
    y += 20;

    if (!filas.length) {
      doc.fill(COLOR_MUTED).font('Helvetica').fontSize(10)
         .text('No hay datos disponibles para este reporte.', 40, y);
      doc.end();
      return;
    }

    // ── Tabla ─────────────────────────────────────────────────────────────
    const colCount = columnas.length;
    const colW     = PAGE_WIDTH / colCount;

    // Encabezado de tabla
    doc.rect(40, y, PAGE_WIDTH, 18).fill(COLOR_DARK);
    columnas.forEach((col, i) => {
      doc.fill('#fff').font('Helvetica-Bold').fontSize(8)
         .text(col, 40 + i * colW + 4, y + 5, { width: colW - 8 });
    });
    y += 18;

    // Filas
    filas.forEach((fila, rowIdx) => {
      // Nueva página si no hay espacio
      if (y + 16 > doc.page.height - 50) {
        doc.addPage();
        y = 40;
      }

      const bg = rowIdx % 2 === 0 ? '#fff' : COLOR_ROW_EVEN;
      doc.rect(40, y, PAGE_WIDTH, 16).fill(bg);

      fila.forEach((celda, i) => {
        const text = celda == null ? '—' : String(celda);
        doc.fill('#17202a').font('Helvetica').fontSize(8)
           .text(text.length > 30 ? text.slice(0, 28) + '…' : text,
                 40 + i * colW + 4, y + 4,
                 { width: colW - 8, lineBreak: false });
      });

      // Línea separadora
      doc.moveTo(40, y + 16).lineTo(40 + PAGE_WIDTH, y + 16)
         .stroke(COLOR_BORDER);
      y += 16;
    });

    // ── Pie de página ─────────────────────────────────────────────────────
    y += 20;
    doc.fill(COLOR_MUTED).font('Helvetica').fontSize(8)
       .text('Sistema de Gestión — Biblioteca Digital SENA', 40, y, { align: 'center', width: PAGE_WIDTH });

    doc.end();
  } catch (err) {
    next(err);
  }
};