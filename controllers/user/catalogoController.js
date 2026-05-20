const mongoose = require('mongoose');
const https = require('https');
const http = require('http');
const Categoria = require('../../models/Categoria');
const Configuracion = require('../../models/Configuracion');
const Ejemplar = require('../../models/Ejemplar');
const Prestamo = require('../../models/Prestamo');
const Recurso = require('../../models/Recurso');
const Reserva = require('../../models/Reserva');
const Sancion = require('../../models/Sancion');
const Usuario = require('../../models/Usuario');
const reservaService = require('../../services/reservaService');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

const TIPO_FISICO = 'F\u00edsico';

// ── Nombre de descarga limpio ─────────────────────────────────────────────
function nombreLimpio(titulo, ext) {
  return String(titulo || 'archivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim()
    .replace(/\s+/g, '_') + '.' + ext;
}

// ── Disponibilidad ────────────────────────────────────────────────────────
function disponibilidadDigital(recurso) {
  if (!recurso.digital) return null;
  return recurso.digital.estado_disponibilidad || 'Disponible';
}
function disponibilidadFisica(recurso) {
  if (!recurso.fisico) return null;
  return recurso.fisico.ejemplares_disponibles > 0 ? 'Disponible' : 'No disponible';
}
function disponibilidadGeneral(recurso) {
  if (recurso.tipo_naturaleza === 'Digital') return disponibilidadDigital(recurso);
  if (recurso.tipo_naturaleza === 'Físico')  return disponibilidadFisica(recurso);
  const d = disponibilidadDigital(recurso);
  const f = disponibilidadFisica(recurso);
  if (d === 'Disponible' || d === 'Acceso libre') return 'Disponible';
  if (f === 'Disponible') return 'Disponible';
  return 'No disponible';
}

function tieneComponenteFisico(recurso) {
  return ['Físico', 'Mixto'].includes(recurso.tipo_naturaleza);
}

async function aplicarConteoFisico(recursos) {
  const lista = Array.isArray(recursos) ? recursos : [recursos];
  const ids = lista
    .filter((recurso) => recurso && tieneComponenteFisico(recurso))
    .map((recurso) => recurso._id);

  if (!ids.length) return recursos;

  const [conteos, retenidos] = await Promise.all([
    Ejemplar.aggregate([
      { $match: { recurso_id: { $in: ids } } },
      {
        $group: {
          _id: '$recurso_id',
          total: { $sum: 1 },
          disponibles: {
            $sum: { $cond: [{ $eq: ['$estado', 'Disponible'] }, 1, 0] },
          },
        },
      },
    ]),
    Reserva.aggregate([
      {
        $match: {
          recurso_id: { $in: ids },
          tipo: TIPO_FISICO,
          estado: 'Disponible para reclamar'
        }
      },
      { $group: { _id: '$recurso_id', total: { $sum: 1 } } }
    ])
  ]);

  const porRecurso = new Map(conteos.map((item) => [String(item._id), item]));
  const retenidosPorRecurso = new Map(retenidos.map((item) => [String(item._id), item.total]));
  for (const recurso of lista) {
    if (!recurso || !tieneComponenteFisico(recurso)) continue;
    const conteo = porRecurso.get(String(recurso._id));
    if (!conteo) continue;
    const retenidos = retenidosPorRecurso.get(String(recurso._id)) || 0;
    recurso.fisico = {
      ...(recurso.fisico || {}),
      total_ejemplares: conteo.total,
      ejemplares_disponibles: Math.max(0, conteo.disponibles - retenidos),
    };
  }

  return recursos;
}

function archivoPrincipal(recurso) {
  return recurso.digital?.archivos?.find((a) => a.es_principal)
    || recurso.digital?.archivos?.[0]
    || null;
}

async function contarPrestamosDigitalesActivos(recursoId) {
  return Prestamo.countDocuments({
    tipo: 'Digital',
    estado: { $in: ['Activo', 'Parcialmente devuelto', 'Vencido'] },
    items: {
      $elemMatch: {
        recurso_id: recursoId,
        estado: { $in: ['Activo', 'Vencido'] }
      }
    }
  });
}

async function prestamoActivoDelUsuario(usuarioId, recursoId) {
  if (!usuarioId) return null;
  return Prestamo.findOne({
    usuario_id: usuarioId,
    estado: { $in: ['Activo', 'Parcialmente devuelto', 'Vencido'] },
    items: {
      $elemMatch: {
        recurso_id: recursoId,
        estado: { $in: ['Activo', 'Vencido'] }
      }
    }
  }).lean();
}

// ── CATÁLOGO ──────────────────────────────────────────────────────────────
exports.index = async (req, res, next) => {
  try {
    const q             = String(req.query.q             || '').trim();
    const tipoContenido = String(req.query.tipo_contenido || '').trim();
    const categoriaId   = String(req.query.categoria_id  || '').trim();

    const filtro = { estado: 'Activo', publicado: true };
    if (q) {
      filtro.$or = [
        { titulo:                           new RegExp(q, 'i') },
        { autor:                            new RegExp(q, 'i') },
        { isbn:                             new RegExp(q, 'i') },
        { 'categorias.categoria_nombre':    new RegExp(q, 'i') },
        { 'categorias.subcategoria_nombre': new RegExp(q, 'i') }
      ];
    }
    if (tipoContenido) filtro.tipo_contenido = tipoContenido;
    if (mongoose.isValidObjectId(categoriaId)) filtro['categorias.categoria_id'] = categoriaId;

    const [recursos, categorias] = await Promise.all([
      Recurso.find(filtro).sort({ publicado_en: -1, creado_en: -1 }).lean(),
      Categoria.find({ activa: true }).sort({ nombre: 1 }).lean()
    ]);
    await aplicarConteoFisico(recursos);

    res.render('user/catalogo/index', {
      title: 'Catálogo',
      recursos: recursos.map((r) => ({ ...r, disponibilidad: disponibilidadGeneral(r) })),
      categorias,
      filtros: { q, tipo_contenido: tipoContenido, categoria_id: categoriaId },
      topbarHero: true,
      pageClass: 'catalog-page'
    });
  } catch (error) {
    next(error);
  }
};

// ── API JSON (AJAX filtering) ─────────────────────────────────────────────
exports.api = async (req, res, next) => {
  try {
    const q              = String(req.query.q || '').trim();
    const tiposMaterial  = req.query.tipo_material ? String(req.query.tipo_material).split(',').filter(Boolean) : [];
    const categoriasIds  = req.query.categorias    ? String(req.query.categorias).split(',').filter(Boolean) : [];
    const subcatsIds     = req.query.subcategorias  ? String(req.query.subcategorias).split(',').filter(Boolean) : [];

    const filtro = { estado: 'Activo', publicado: true };

    if (q) {
      filtro.$or = [
        { titulo:                           new RegExp(q, 'i') },
        { autor:                            new RegExp(q, 'i') },
        { isbn:                             new RegExp(q, 'i') },
        { 'categorias.categoria_nombre':    new RegExp(q, 'i') },
        { 'categorias.subcategoria_nombre': new RegExp(q, 'i') }
      ];
    }
    if (tiposMaterial.length) filtro.tipo_material = { $in: tiposMaterial };
    if (categoriasIds.length) {
      const validIds = categoriasIds.filter((id) => mongoose.isValidObjectId(id));
      if (validIds.length) filtro['categorias.categoria_id'] = { $in: validIds };
    }
    if (subcatsIds.length) {
      const validIds = subcatsIds.filter((id) => mongoose.isValidObjectId(id));
      if (validIds.length) filtro['categorias.subcategoria_id'] = { $in: validIds };
    }

    const recursos = await Recurso.find(filtro).sort({ publicado_en: -1, creado_en: -1 }).lean();
    await aplicarConteoFisico(recursos);

    return res.json(recursos.map((r) => ({
      _id: r._id,
      titulo: r.titulo,
      autor: r.autor,
      tipo_contenido: r.tipo_contenido,
      tipo_material: r.tipo_material,
      tipo_naturaleza: r.tipo_naturaleza,
      descripcion: r.descripcion,
      imagen: r.imagen,
      categorias: r.categorias,
      disponibilidad: disponibilidadGeneral(r)
    })));
  } catch (error) {
    next(error);
  }
};

// ── DETALLE ───────────────────────────────────────────────────────────────
exports.detalle = async (req, res, next) => {
  try {
    const recurso = await Recurso.findOne({
      _id: req.params.id, estado: 'Activo', publicado: true
    }).lean();

    if (!recurso) {
      return res.status(404).render('error', {
        title: 'Recurso no encontrado',
        message: 'El recurso no está disponible.'
      });
    }
    await aplicarConteoFisico(recurso);

    const [reservaActiva, prestamoActivo, licenciasEnUsoReal] = await Promise.all([
      req.session.userId
        ? Reserva.findOne({
            usuario_id: req.session.userId,
            recurso_id: recurso._id,
            estado: { $in: ['Pendiente', 'Disponible para reclamar'] }
          }).lean()
        : null,
      prestamoActivoDelUsuario(req.session.userId, recurso._id),
      contarPrestamosDigitalesActivos(recurso._id)
    ]);

    if (recurso.digital) recurso.digital.licencias_en_uso = licenciasEnUsoReal;

    // Incrementar vistas
    Recurso.findByIdAndUpdate(recurso._id, { $inc: { total_vistas: 1 } }).catch(() => {});

    let prestamoActivoItem = null;
    if (prestamoActivo) {
      const item = (prestamoActivo.items || []).find(
        (i) => String(i.recurso_id) === String(recurso._id) && ['Activo', 'Vencido'].includes(i.estado)
      );
      if (item) {
        prestamoActivoItem = {
          prestamo_id:  prestamoActivo._id,
          item_id:      item._id,
          tipo:         prestamoActivo.tipo,
          fecha_limite: item.fecha_limite
        };
      }
    }

    return res.render('user/catalogo/detalle', {
      title: recurso.titulo,
      recurso: {
        ...recurso,
        disponibilidad:        disponibilidadGeneral(recurso),
        disponibilidadDigital: disponibilidadDigital(recurso),
        disponibilidadFisica:  disponibilidadFisica(recurso),
        reservable:            reservaService.esRecursoReservable(recurso),
        tieneReservaActiva:    Boolean(reservaActiva),
        reservaActiva,
        prestamoActivoItem,
        archivo:               archivoPrincipal(recurso)
      }
    });
  } catch (error) {
    next(error);
  }
};

// ── SOLICITAR PRÉSTAMO DIGITAL ────────────────────────────────────────────
exports.prestar = async (req, res, next) => {
  try {
    if (!req.session.userId) return res.redirect('/login');

    const recurso = await Recurso.findOne({
      _id: req.params.id, estado: 'Activo', publicado: true
    }).lean();

    if (!recurso || !recurso.digital) {
      flash(req, 'error', 'El recurso no está disponible.');
      return res.redirect(`/catalogo/${req.params.id}`);
    }
    if (recurso.digital.estado_disponibilidad === 'Acceso libre') {
      flash(req, 'error', 'Este recurso es de acceso libre, no necesitas prestarlo.');
      return res.redirect(`/catalogo/${req.params.id}`);
    }

    const licencia = recurso.digital.licencia;
    const enUso    = await contarPrestamosDigitalesActivos(recurso._id);
    const maxSim   = licencia?.usuarios_simultaneos || 1;
    if (enUso >= maxSim) {
      flash(req, 'error', 'No hay licencias disponibles. Puedes reservarlo.');
      return res.redirect(`/catalogo/${req.params.id}`);
    }

    const usuario = await Usuario.findById(req.session.userId).lean();
    if (!usuario) return res.redirect('/login');

    const sancionActiva = await Sancion.exists({ usuario_id: usuario._id, estado: 'Activa' });
    if (sancionActiva) {
      flash(req, 'error', 'Tienes una sanción activa. No puedes realizar préstamos.');
      return res.redirect(`/catalogo/${req.params.id}`);
    }

    const yaLoTiene = await Prestamo.exists({
      usuario_id: usuario._id,
      estado: { $in: ['Activo', 'Parcialmente devuelto', 'Vencido'] },
      items: {
        $elemMatch: {
          recurso_id: recurso._id,
          estado: { $in: ['Activo', 'Vencido'] }
        }
      }
    });
    if (yaLoTiene) {
      flash(req, 'error', 'Ya tienes un préstamo activo de este recurso.');
      return res.redirect(`/catalogo/${req.params.id}`);
    }

    const config = await Configuracion.findOne().lean();
    const maxDigitales = config?.prestamos_digitales?.max_prestamos_por_usuario || 5;
    if ((usuario.prestamos_activos || 0) >= maxDigitales) {
      flash(req, 'error', `Has alcanzado el límite de ${maxDigitales} préstamos activos.`);
      return res.redirect(`/catalogo/${req.params.id}`);
    }

    const duracionDias = licencia?.duracion_prestamo
      || config?.prestamos_digitales?.duracion_defecto_dias
      || 7;

    const fechaInicio = new Date();
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + Number(duracionDias));
    const archivoRec = archivoPrincipal(recurso);

    await Prestamo.create({
      usuario_id:        usuario._id,
      usuario_nombre:    usuario.nombre,
      usuario_documento: usuario.documento,
      registrado_por:    usuario._id,
      tipo: 'Digital',
      items: [{
        recurso_id:      recurso._id,
        recurso_titulo:  recurso.titulo,
        formato_tipo:    archivoRec?.tipo || 'pdf',
        fecha_inicio:    fechaInicio,
        fecha_limite:    fechaLimite,
        dias_tolerancia: config?.prestamos_fisicos?.dias_tolerancia || 2,
        estado: 'Activo'
      }],
      estado: 'Activo',
      tiene_sancion:  false,
      creado_en:      fechaInicio,
      actualizado_en: fechaInicio
    });

    await Recurso.findByIdAndUpdate(recurso._id, {
      $set: { 'digital.licencias_en_uso': enUso + 1 },
      $inc: { total_prestamos: 1 },
      actualizado_en: new Date()
    });
    await Usuario.findByIdAndUpdate(usuario._id, {
      $inc: { prestamos_activos: 1 },
      actualizado_en: new Date()
    });

    flash(req, 'success', `Préstamo registrado. Tienes acceso hasta el ${fechaLimite.toLocaleDateString('es-CO')}.`);
    return res.redirect(`/catalogo/${req.params.id}`);
  } catch (error) {
    next(error);
  }
};

// ── VISOR ─────────────────────────────────────────────────────────────────
exports.ver = async (req, res, next) => {
  try {
    if (!req.session.userId) return res.redirect('/login');

    const recurso = await Recurso.findOne({
      _id: req.params.id, estado: 'Activo', publicado: true
    }).lean();

    if (!recurso || !recurso.digital?.archivos?.length) {
      return res.status(404).render('error', {
        title: 'Archivo no encontrado',
        message: 'No se encontró el archivo digital para este recurso.'
      });
    }

    const esLibre = recurso.digital.estado_disponibilidad === 'Acceso libre';

    if (!esLibre) {
      const prestamo = await Prestamo.findOne({
        usuario_id: req.session.userId,
        tipo: 'Digital',
        estado: { $in: ['Activo', 'Parcialmente devuelto'] },
        'items.recurso_id': recurso._id,
        'items.estado': 'Activo'
      }).lean();
      if (!prestamo) {
        flash(req, 'error', 'Necesitas un préstamo activo para acceder a este recurso.');
        return res.redirect(`/catalogo/${req.params.id}`);
      }
    }

    const archivo = archivoPrincipal(recurso);
    if (!archivo) {
      return res.status(404).render('error', {
        title: 'Archivo no encontrado',
        message: 'No se encontró el archivo principal.'
      });
    }

    const esLectura      = recurso.tipo_contenido === 'Lectura';
    const puedeDescargar = esLibre && esLectura && archivo.tipo !== 'epub';

    return res.render('user/archivo/ver', {
      title:         recurso.titulo,
      recurso,
      archivo,
      esLibre,
      puedeDescargar,
      // Ruta interna del servidor para la descarga (proxy)
      urlDescarga: puedeDescargar
        ? `/catalogo/${recurso._id}/descargar`
        : null,
      backUrl: `/catalogo/${recurso._id}`
    });
  } catch (error) {
    next(error);
  }
};

// ── DESCARGA — proxy Express ──────────────────────────────────────────────
// Descarga el archivo desde Cloudinary en el servidor y lo reenvía al navegador
// con Content-Disposition: attachment y nombre correcto.
// Esto funciona para CUALQUIER resource_type (raw, video, image).
exports.descargar = async (req, res, next) => {
  try {
    if (!req.session.userId) return res.redirect('/login');

    const recurso = await Recurso.findOne({
      _id: req.params.id, estado: 'Activo', publicado: true
    }).lean();

    if (!recurso || !recurso.digital?.archivos?.length) {
      return res.status(404).render('error', {
        title: 'Archivo no encontrado',
        message: 'No se encontró el archivo digital para este recurso.'
      });
    }

    if (recurso.tipo_contenido !== 'Lectura') {
      return res.status(403).render('error', {
        title: 'Descarga no permitida',
        message: 'Solo los recursos de tipo Lectura con acceso libre pueden descargarse.'
      });
    }

    if (recurso.digital.estado_disponibilidad !== 'Acceso libre') {
      return res.status(403).render('error', {
        title: 'Descarga no permitida',
        message: 'Los recursos con licencia restringida solo pueden accederse dentro de la plataforma.'
      });
    }

    const archivo = archivoPrincipal(recurso);
    if (!archivo?.url) {
      return res.status(404).render('error', {
        title: 'Archivo no encontrado',
        message: 'No se encontró el archivo.'
      });
    }

    if (archivo.tipo === 'epub') {
      return res.redirect(`/catalogo/${recurso._id}/ver`);
    }

    // Nombre de descarga limpio
    const filename = nombreLimpio(recurso.titulo, archivo.tipo);

    // Tipo MIME correcto según extensión
    const mimes = {
      pdf:  'application/pdf',
      epub: 'application/epub+zip',
      mp3:  'audio/mpeg',
      mp4:  'video/mp4'
    };
    const contentType = mimes[archivo.tipo] || 'application/octet-stream';

    // Proxy: el servidor descarga de Cloudinary y reenvía al navegador
    // con el nombre correcto — sin pasar transformaciones a Cloudinary
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);

    const urlObj = new URL(archivo.url);
    const lib = urlObj.protocol === 'https:' ? https : http;

    const cloudReq = lib.get(archivo.url, (cloudRes) => {
      // Si Cloudinary redirige, seguir la redirección
      if (cloudRes.statusCode === 301 || cloudRes.statusCode === 302) {
        const redirectUrl = cloudRes.headers.location;
        const redirectLib = redirectUrl.startsWith('https') ? https : http;
        redirectLib.get(redirectUrl, (r2) => r2.pipe(res)).on('error', next);
        return;
      }
      cloudRes.pipe(res);
    });

    cloudReq.on('error', next);

  } catch (error) {
    next(error);
  }
};

// ── Categorías con recursos ───────────────────────────────────────────────
exports.categorias = async (req, res, next) => {
  try {
    const categorias = await Categoria.find({ activa: true }).sort({ nombre: 1 }).lean();
    res.render('user/catalogo/categorias', {
      title: 'Categorías',
      categorias,
      pageClass: 'catalog-page'
    });
  } catch (error) {
    next(error);
  }
};

exports.apiCategoriaRecursos = async (req, res, next) => {
  try {
    const { id } = req.params;
    const filtro = { estado: 'Activo', publicado: true };
    if (id && id !== 'all') {
      if (mongoose.isValidObjectId(id)) {
        filtro['categorias.categoria_id'] = new mongoose.Types.ObjectId(id);
      }
    }
    const recursos = await Recurso.find(filtro)
      .sort({ publicado_en: -1, creado_en: -1 })
      .limit(40)
      .lean();
    res.json({ recursos });
  } catch (error) {
    next(error);
  }
};

// ── Novedades ─────────────────────────────────────────────────────────────
exports.novedades = async (req, res, next) => {
  try {
    const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [recientes, categorias] = await Promise.all([
      Recurso.find({ estado: 'Activo', publicado: true })
        .sort({ publicado_en: -1, creado_en: -1 })
        .limit(40)
        .lean(),
      Categoria.find({ activa: true }).sort({ nombre: 1 }).lean()
    ]);
    res.render('user/catalogo/novedades', {
      title: 'Novedades',
      recursos: recientes,
      categorias,
      pageClass: 'catalog-page'
    });
  } catch (error) {
    next(error);
  }
};

// ── Más leídos ───────────────────────────────────────────────────────────
exports.masLeidos = async (req, res, next) => {
  try {
    const [masVistos, categorias] = await Promise.all([
      Recurso.find({ estado: 'Activo', publicado: true, total_vistas: { $gt: 0 } })
        .sort({ total_vistas: -1 })
        .limit(40)
        .lean(),
      Categoria.find({ activa: true }).sort({ nombre: 1 }).lean()
    ]);
    // Si no hay vistas aún, ordenar por préstamos
    const recursos = masVistos.length > 0 ? masVistos :
      await Recurso.find({ estado: 'Activo', publicado: true })
        .sort({ total_prestamos: -1, total_reservas: -1 })
        .limit(40)
        .lean();

    res.render('user/catalogo/mas-leidos', {
      title: 'Más leídos',
      recursos,
      categorias,
      pageClass: 'catalog-page'
    });
  } catch (error) {
    next(error);
  }
};
