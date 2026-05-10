const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Categoria = require('../../models/Categoria');
const Prestamo = require('../../models/Prestamo');
const Recurso = require('../../models/Recurso');
const Reserva = require('../../models/Reserva');
const reservaService = require('../../services/reservaService');

function disponibilidad(recurso) {
  if (['Digital', 'Mixto'].includes(recurso.tipo_naturaleza)) {
    return recurso.digital?.estado_disponibilidad || 'Disponible';
  }

  if (recurso.fisico?.ejemplares_disponibles > 0) return 'Disponible';
  return 'No disponible';
}

exports.index = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const tipoContenido = String(req.query.tipo_contenido || '').trim();
    const categoriaId = String(req.query.categoria_id || '').trim();

    const filtro = {
      estado: 'Activo',
      publicado: true
    };

    if (q) {
      filtro.$or = [
        { titulo: new RegExp(q, 'i') },
        { autor: new RegExp(q, 'i') },
        { isbn: new RegExp(q, 'i') },
        { 'categorias.categoria_nombre': new RegExp(q, 'i') },
        { 'categorias.subcategoria_nombre': new RegExp(q, 'i') }
      ];
    }

    if (tipoContenido) filtro.tipo_contenido = tipoContenido;
    if (mongoose.isValidObjectId(categoriaId)) filtro['categorias.categoria_id'] = categoriaId;

    const [recursos, categorias] = await Promise.all([
      Recurso.find(filtro).sort({ publicado_en: -1, creado_en: -1 }).lean(),
      Categoria.find({ activa: true }).sort({ nombre: 1 }).lean()
    ]);

    res.render('user/catalogo/index', {
      title: 'Catalogo',
      recursos: recursos.map((recurso) => ({
        ...recurso,
        disponibilidad: disponibilidad(recurso)
      })),
      categorias,
      filtros: { q, tipo_contenido: tipoContenido, categoria_id: categoriaId }
    });
  } catch (error) {
    next(error);
  }
};

function archivoPrincipal(recurso) {
  return recurso.digital?.archivos?.find((archivo) => archivo.es_principal) || recurso.digital?.archivos?.[0];
}

exports.detalle = async (req, res, next) => {
  try {
    const recurso = await Recurso.findOne({
      _id: req.params.id,
      estado: 'Activo',
      publicado: true
    }).lean();

    if (!recurso) return res.status(404).render('error', { title: 'Recurso no encontrado', message: 'El recurso no esta disponible.' });

    const tieneReservaActiva = req.session.userId
      ? Boolean(await Reserva.exists({
          usuario_id: req.session.userId,
          recurso_id: recurso._id,
          estado: { $in: ['Pendiente', 'Disponible para reclamar'] }
        }))
      : false;

    let prestamoActivoItem = null;
    if (req.session.userId) {
      const prestamo = await Prestamo.findOne({
        usuario_id: req.session.userId,
        estado: { $in: ['Activo', 'Parcialmente devuelto'] },
        'items.recurso_id': recurso._id
      }).lean();

      if (prestamo) {
        const item = (prestamo.items || []).find((i) => String(i.recurso_id) === String(recurso._id) && i.estado === 'Activo');
        if (item) {
          prestamoActivoItem = {
            prestamo_id: prestamo._id,
            item_id: item._id
          };
        }
      }
    }

    return res.render('user/catalogo/detalle', {
      title: recurso.titulo,
      recurso: {
        ...recurso,
        disponibilidad: disponibilidad(recurso),
        reservable: reservaService.esRecursoReservable(recurso),
        tieneReservaActiva,
        prestamoActivoItem,
        archivoPrincipal: archivoPrincipal(recurso)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.descargar = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login');
    }

    const recurso = await Recurso.findOne({
      _id: req.params.id,
      estado: 'Activo',
      publicado: true
    }).lean();

    if (!recurso || !recurso.digital?.archivos?.length) {
      return res.status(404).render('error', { title: 'Archivo no encontrado', message: 'No se encontr├│ el archivo digital para este recurso.' });
    }

    // Verificar acceso: acceso libre O pr├®stamo activo
    let tieneAcceso = recurso.digital.estado_disponibilidad === 'Acceso libre';
    
    if (!tieneAcceso) {
      const prestamo = await Prestamo.findOne({
        usuario_id: req.session.userId,
        estado: { $in: ['Activo', 'Parcialmente devuelto'] },
        'items.recurso_id': recurso._id,
        'items.estado': 'Activo'
      }).lean();
      tieneAcceso = Boolean(prestamo);
    }

    if (!tieneAcceso) {
      return res.status(403).render('error', { title: 'Acceso restringido', message: 'No tienes acceso a este archivo. Requiere un pr├®stamo activo.' });
    }

    const archivo = archivoPrincipal(recurso);
    if (!archivo) {
      return res.status(404).render('error', { title: 'Archivo no encontrado', message: 'No se encontr├│ el archivo principal del recurso.' });
    }

    // Generar nombre de descarga
    const ext = archivo.tipo === 'url' ? 'html' : archivo.tipo;
    const filename = `${recurso.titulo.replace(/[^\w\s-]/g, '').trim()}.${ext}`;

    if (serveLocalArchivo(res, archivo, filename, 'attachment')) return;

    if (archivo.url) {
      return res.redirect(archivo.url);
    }

    return res.status(404).render('error', {
      title: 'Archivo no encontrado',
      message: 'No se encontr├│ el archivo local para descargar.'
    });
  } catch (error) {
    next(error);
  }
};

function getMimeType(tipo) {
  const mimes = {
    pdf: 'application/pdf',
    epub: 'application/epub+zip',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    url: 'text/html'
  };
  return mimes[tipo] || 'application/octet-stream';
}

function localArchivoPath(archivo) {
  if (!archivo?.public_id) return null;
  return path.join(__dirname, '../../public/uploads', archivo.public_id);
}

function serveLocalArchivo(res, archivo, filename, disposition = 'attachment') {
  const filepath = localArchivoPath(archivo);
  if (!filepath || !fs.existsSync(filepath)) return false;

  res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
  res.setHeader('Content-Type', getMimeType(archivo.tipo));
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  return res.sendFile(filepath);
}

async function resourceAccessibleForUser(req, recurso, requireLoan = false) {
  if (recurso.digital.estado_disponibilidad === 'Acceso libre' && !requireLoan) {
    return true;
  }

  if (!req.session.userId) return false;

  const prestamo = await Prestamo.findOne({
    usuario_id: req.session.userId,
    estado: { $in: ['Activo', 'Parcialmente devuelto'] },
    'items.recurso_id': recurso._id,
    'items.estado': 'Activo'
  }).lean();
  return Boolean(prestamo);
}

exports.archivo = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login');
    }

    const recurso = await Recurso.findOne({
      _id: req.params.id,
      estado: 'Activo',
      publicado: true
    }).lean();

    if (!recurso || !recurso.digital?.archivos?.length) {
      return res.status(404).render('error', { title: 'Archivo no encontrado', message: 'No se encontr├│ el archivo digital para este recurso.' });
    }

    const archivo = archivoPrincipal(recurso);
    if (!archivo) {
      return res.status(404).render('error', { title: 'Archivo no encontrado', message: 'No se encontr├│ el archivo principal del recurso.' });
    }

    const tieneAcceso = await resourceAccessibleForUser(req, recurso, false);
    if (!tieneAcceso) {
      return res.status(403).render('error', { title: 'Acceso restringido', message: 'No tienes acceso para ver este archivo.' });
    }

    const filename = `${recurso.titulo.replace(/[^ -]/g, '').replace(/[^\w\s-]/g, '').trim() || 'recurso'}.${archivo.tipo === 'url' ? 'html' : archivo.tipo}`;
    if (serveLocalArchivo(res, archivo, filename, 'inline')) return;

    // Fallback to remote file URL for view if local copy is unavailable.
    return res.redirect(archivo.url);
  } catch (error) {
    next(error);
  }
};

exports.ver = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login');
    }

    const recurso = await Recurso.findOne({
      _id: req.params.id,
      estado: 'Activo',
      publicado: true
    }).lean();

    if (!recurso || !recurso.digital?.archivos?.length) {
      return res.status(404).render('error', { title: 'Archivo no encontrado', message: 'No se encontr├│ el archivo digital para este recurso.' });
    }

    if (recurso.digital.estado_disponibilidad !== 'Acceso libre') {
      return res.status(403).render('error', { title: 'Acceso restringido', message: 'Este recurso no est├í disponible para acceso libre.' });
    }

    const archivo = archivoPrincipal(recurso);
    if (!archivo) {
      return res.status(404).render('error', { title: 'Archivo no encontrado', message: 'No se encontr├│ el archivo principal del recurso.' });
    }

    return res.render('user/archivo/ver', {
      title: `Acceder a ${recurso.titulo}`,
      recurso,
      archivo,
      backUrl: `/catalogo/${recurso._id}`,
      downloadLink: `/catalogo/${recurso._id}/descargar`,
      archivoViewUrl: `/catalogo/${recurso._id}/archivo`
    });
  } catch (error) {
    next(error);
  }
};
