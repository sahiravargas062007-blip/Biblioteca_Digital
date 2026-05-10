const Administrador = require('../../models/Administrador');
const Configuracion = require('../../models/Configuracion');
const Prestamo = require('../../models/Prestamo');
const Sancion = require('../../models/Sancion');
const Usuario = require('../../models/Usuario');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + Number(days || 0));
  return result;
}

async function sugerirSancion(tipoIncidencia, gravedad) {
  const config = await Configuracion.findOne().lean();
  const regla = config?.sanciones?.reglas?.find((item) => (
    item.tipo_incidencia === tipoIncidencia && item.gravedad === gravedad
  ));

  return {
    tipo_sancion: regla?.tipo_sancion || 'Advertencia',
    dias_suspension: regla?.dias_suspension || 0,
    incluye_multa: Boolean(config?.sanciones?.incluir_multas)
  };
}

async function crearSancionDesdePayload(req, payload) {
  const admin = await Administrador.findById(req.session.adminId).lean();
  const usuario = await Usuario.findById(payload.usuario_id);
  if (!usuario) throw new Error('Usuario no encontrado.');

  const now = new Date();
  const diasSuspension = Number(payload.dias_suspension || 0);
  const sancion = await Sancion.create({
    usuario_id: usuario._id,
    usuario_nombre: usuario.nombre,
    usuario_documento: usuario.documento,
    prestamo_id: payload.prestamo_id || undefined,
    item_prestamo_id: payload.item_prestamo_id || undefined,
    recurso_titulo: payload.recurso_titulo || '',
    ejemplar_codigo: payload.ejemplar_codigo || '',
    tipo_incidencia: payload.tipo_incidencia,
    gravedad: payload.gravedad,
    tipo_sancion: payload.tipo_sancion,
    observaciones: payload.observaciones || '',
    dias_suspension: diasSuspension,
    fecha_inicio: now,
    fecha_fin: payload.tipo_sancion === 'Suspensión' ? addDays(now, diasSuspension) : undefined,
    incluye_multa: payload.incluye_multa === 'true' || payload.incluye_multa === true,
    valor_multa: Number(payload.valor_multa || 0),
    estado: 'Activa',
    registrada_por: req.session.adminId,
    registrada_por_nombre: admin?.nombre || 'Administrador',
    creado_en: now,
    actualizado_en: now
  });

  usuario.estado = 'Sancionado';
  usuario.actualizado_en = now;
  await usuario.save();

  if (payload.prestamo_id) {
    await Prestamo.findByIdAndUpdate(payload.prestamo_id, {
      tiene_sancion: true,
      sancion_id: sancion._id,
      actualizado_en: now
    });
  }

  return sancion;
}

exports.index = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const tipo = String(req.query.tipo_sancion || '').trim();
    const filtro = { estado: 'Activa' };

    if (q) {
      filtro.$or = [
        { usuario_nombre: new RegExp(q, 'i') },
        { usuario_documento: new RegExp(q, 'i') },
        { recurso_titulo: new RegExp(q, 'i') },
        { ejemplar_codigo: new RegExp(q, 'i') }
      ];
    }
    if (tipo) filtro.tipo_sancion = tipo;

    const sanciones = await Sancion.find(filtro).sort({ creado_en: -1 }).lean();
    res.render('admin/sanciones/index', {
      title: 'Sanciones activas',
      sanciones,
      filtros: { q, tipo_sancion: tipo }
    });
  } catch (error) {
    next(error);
  }
};

exports.historial = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const estado = String(req.query.estado || '').trim();
    const filtro = {};

    if (q) {
      filtro.$or = [
        { usuario_nombre: new RegExp(q, 'i') },
        { usuario_documento: new RegExp(q, 'i') },
        { recurso_titulo: new RegExp(q, 'i') },
        { ejemplar_codigo: new RegExp(q, 'i') }
      ];
    }
    if (estado) filtro.estado = estado;

    const sanciones = await Sancion.find(filtro).sort({ creado_en: -1 }).lean();
    res.render('admin/sanciones/historial', {
      title: 'Historial de sanciones',
      sanciones,
      filtros: { q, estado }
    });
  } catch (error) {
    next(error);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const tipoIncidencia = req.body.tipo_incidencia;
    const gravedad = req.body.gravedad;
    const sugerida = await sugerirSancion(tipoIncidencia, gravedad);

    await crearSancionDesdePayload(req, {
      ...req.body,
      tipo_sancion: req.body.tipo_sancion || sugerida.tipo_sancion,
      dias_suspension: req.body.dias_suspension || sugerida.dias_suspension,
      incluye_multa: req.body.incluye_multa || sugerida.incluye_multa
    });

    flash(req, 'success', 'Sanción registrada correctamente.');
    return res.redirect(req.body.redirect_to || '/admin/sanciones');
  } catch (error) {
    next(error);
  }
};

exports.levantar = async (req, res, next) => {
  try {
    const admin = await Administrador.findById(req.session.adminId).lean();
    const sancion = await Sancion.findById(req.params.id);

    if (!sancion) {
      flash(req, 'error', 'La sanción no existe.');
      return res.redirect('/admin/sanciones');
    }

    sancion.estado = 'Levantada';
    sancion.levantada_por = req.session.adminId;
    sancion.levantada_por_nombre = admin?.nombre || 'Administrador';
    sancion.fecha_levantamiento = new Date();
    sancion.motivo_levantamiento = req.body.motivo_levantamiento || 'Levantada manualmente';
    sancion.actualizado_en = new Date();
    await sancion.save();

    const sancionesActivas = await Sancion.countDocuments({
      usuario_id: sancion.usuario_id,
      estado: 'Activa',
      _id: { $ne: sancion._id }
    });

    if (!sancionesActivas) {
      await Usuario.findByIdAndUpdate(sancion.usuario_id, {
        estado: 'Activo',
        actualizado_en: new Date()
      });
    }

    flash(req, 'success', 'Sanción levantada correctamente.');
    return res.redirect('/admin/sanciones');
  } catch (error) {
    next(error);
  }
};

exports.sugerir = async (req, res, next) => {
  try {
    const data = await sugerirSancion(req.query.tipo_incidencia, req.query.gravedad);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

exports._crearSancionDesdePayload = crearSancionDesdePayload;
exports._sugerirSancion = sugerirSancion;
