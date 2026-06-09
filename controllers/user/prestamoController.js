const Prestamo = require('../../models/Prestamo');
const Recurso = require('../../models/Recurso');
const Usuario = require('../../models/Usuario');
const Notificacion = require('../../models/Notificacion');
const cloudinary = require('../../config/cloudinary');
const notifService = require('../../services/notificacionService');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

function nombreDescarga(recurso, archivo) {
  const ext = archivo.tipo === 'url' ? 'html' : archivo.tipo;
  const nombre = String(recurso.titulo || archivo.public_id || 'archivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
  return `${nombre}.${ext}`;
}

function buildCloudinaryUrl(archivo, options = {}) {
  if (!archivo?.public_id) return archivo.url;
  return cloudinary.url(archivo.public_id, {
    resource_type: 'raw',
    secure: true,
    ...options
  });
}

exports.index = async (req, res, next) => {
  try {
    const prestamos = await Prestamo.find({
      usuario_id: req.session.userId,
      estado: { $in: ['Activo', 'Parcialmente devuelto', 'Vencido'] }
    }).sort({ creado_en: -1 }).lean();

    const now = new Date();
    const prestamosConEstado = prestamos.map((prestamo) => {
      const items = (prestamo.items || []).map((item) => {
        const diasFaltantes = Math.ceil((new Date(item.fecha_limite) - now) / (1000 * 60 * 60 * 24));
        const estaVencido = diasFaltantes < 0;
        const proximoVencer = diasFaltantes <= 3 && diasFaltantes >= 0;

        return {
          ...item,
          diasFaltantes,
          estaVencido,
          proximoVencer,
          estado_visual: estaVencido ? 'Vencido' : proximoVencer ? 'Próximo a vencer' : item.estado
        };
      });

      return {
        ...prestamo,
        items,
        tieneAlgunVencido: items.some(i => i.estaVencido),
        tieneAlgunProximoVencer: items.some(i => i.proximoVencer && !i.estaVencido)
      };
    });

    res.render('user/prestamos/index', {
      title: 'Mis préstamos',
      prestamos: prestamosConEstado
    });
  } catch (error) {
    next(error);
  }
};

exports.devolverDigital = async (req, res, next) => {
  try {
    const prestamo = await Prestamo.findById(req.params.id);
    if (!prestamo || String(prestamo.usuario_id) !== String(req.session.userId)) {
      flash(req, 'error', 'No se encontró el préstamo.');
      return res.redirect('/prestamos');
    }

    const item = prestamo.items.find(i => String(i._id) === String(req.body.item_id));
    if (!item || item.estado !== 'Activo') {
      flash(req, 'error', 'No se puede devolver este recurso.');
      return res.redirect('/prestamos');
    }

    item.estado = 'Devuelto';
    item.fecha_devolucion_real = new Date();
    item.devolucion = {
      fecha: new Date(),
      observaciones: 'Devuelto digitalmente por el usuario',
      estado_ejemplar_al_devolver: 'Bueno'
    };

    const todosDevueltos = prestamo.items.every(i => i.estado === 'Devuelto');
    prestamo.estado = todosDevueltos ? 'Devuelto' : 'Parcialmente devuelto';
    prestamo.actualizado_en = new Date();
    await prestamo.save();

    await Usuario.findByIdAndUpdate(prestamo.usuario_id, {
      $inc: { prestamos_activos: todosDevueltos ? -1 : 0 },
      actualizado_en: new Date()
    });

    const licenciasActivas = await Prestamo.countDocuments({
      tipo: 'Digital',
      estado: { $in: ['Activo', 'Parcialmente devuelto', 'Vencido'] },
      items: {
        $elemMatch: {
          recurso_id: item.recurso_id,
          estado: { $in: ['Activo', 'Vencido'] }
        }
      }
    });
    await Recurso.findByIdAndUpdate(item.recurso_id, {
      $set: { 'digital.licencias_en_uso': licenciasActivas },
      actualizado_en: new Date()
    });

    try {
      const usuario = await Usuario.findById(prestamo.usuario_id);
      if (usuario) {
        await notifService.devolucionConfirmada(usuario, prestamo, item);
      }
    } catch (_e) { }

    flash(req, 'success', 'Devolución registrada correctamente.');
    return res.redirect('/prestamos');
  } catch (error) {
    next(error);
  }
};

exports.acceder = async (req, res, next) => {
  try {
    const prestamo = await Prestamo.findById(req.params.id).lean();
    if (!prestamo || String(prestamo.usuario_id) !== String(req.session.userId)) {
      flash(req, 'error', 'No se encontró el préstamo.');
      return res.redirect('/prestamos');
    }

    const item = (prestamo.items || []).find((i) => String(i._id) === String(req.params.item_id));
    if (!item || item.estado !== 'Activo') {
      flash(req, 'error', 'No se puede acceder a este recurso.');
      return res.redirect('/prestamos');
    }

    const recurso = await Recurso.findById(item.recurso_id).lean();
    if (!recurso || !recurso.digital?.archivos?.length) {
      flash(req, 'error', 'No se encontró el archivo digital asociado.');
      return res.redirect('/prestamos');
    }

    const archivo = recurso.digital.archivos.find((a) => a.es_principal) || recurso.digital.archivos[0];

    if (!archivo) {
      flash(req, 'error', 'No se encontró el archivo principal del recurso.');
      return res.redirect('/prestamos');
    }

    return res.render('user/archivo/ver', {
      title: `Acceder a ${recurso.titulo}`,
      recurso,
      archivo,
      backUrl: '/prestamos',
      puedeDescargar: false,
      urlDescarga: null,
      downloadLink: `/prestamos/${req.params.id}/descargar/${req.params.item_id}`,
      archivoViewUrl: `/prestamos/${req.params.id}/archivo/${req.params.item_id}`
    });
  } catch (error) {
    next(error);
  }
};

exports.archivo = async (req, res, next) => {
  try {
    const prestamo = await Prestamo.findById(req.params.id).lean();
    if (!prestamo || String(prestamo.usuario_id) !== String(req.session.userId)) {
      flash(req, 'error', 'No se encontró el préstamo.');
      return res.redirect('/prestamos');
    }

    const item = (prestamo.items || []).find((i) => String(i._id) === String(req.params.item_id));
    if (!item || item.estado !== 'Activo') {
      flash(req, 'error', 'No se puede acceder a este recurso.');
      return res.redirect('/prestamos');
    }

    const recurso = await Recurso.findById(item.recurso_id).lean();
    if (!recurso || !recurso.digital?.archivos?.length) {
      flash(req, 'error', 'No se encontró el archivo digital asociado.');
      return res.redirect('/prestamos');
    }

    const archivo = recurso.digital.archivos.find((a) => a.es_principal) || recurso.digital.archivos[0];
    if (!archivo) {
      flash(req, 'error', 'No se encontró el archivo principal del recurso.');
      return res.redirect('/prestamos');
    }

    let archivoUrl = archivo.url;
    if (archivo.tipo !== 'url' && archivo.public_id) {
      archivoUrl = buildCloudinaryUrl(archivo, {
        flags: 'attachment:false'
      });
    }

    return res.redirect(archivoUrl);

  } catch (error) {
    next(error);
  }
};

exports.descargarPrestamo = async (req, res, next) => {
  try {
    const prestamo = await Prestamo.findById(req.params.id).lean();
    if (!prestamo || String(prestamo.usuario_id) !== String(req.session.userId)) {
      flash(req, 'error', 'No se encontró el préstamo.');
      return res.redirect('/prestamos');
    }

    const item = (prestamo.items || []).find((i) => String(i._id) === String(req.params.item_id));
    if (!item || item.estado !== 'Activo') {
      flash(req, 'error', 'No tienes acceso a este recurso.');
      return res.redirect('/prestamos');
    }

    const recurso = await Recurso.findById(item.recurso_id).lean();
    const archivo = recurso?.digital?.archivos?.find((a) => a.es_principal) || recurso?.digital?.archivos?.[0];

    if (!archivo?.url) {
      flash(req, 'error', 'No se encontró el archivo.');
      return res.redirect('/prestamos');
    }

    let descargaUrl = archivo.url;
    if (archivo.tipo !== 'url' && archivo.public_id) {
      descargaUrl = buildCloudinaryUrl(archivo, {
        flags: `attachment:${nombreDescarga(recurso, archivo)}`
      });
    }

    return res.redirect(descargaUrl);

  } catch (error) {
    next(error);
  }
};
