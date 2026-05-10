const Prestamo = require('../../models/Prestamo');
const Recurso = require('../../models/Recurso');
const Usuario = require('../../models/Usuario');
const Notificacion = require('../../models/Notificacion');

function flash(req, type, message) {
  req.session.flash = { type, message };
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

    await Notificacion.create({
      destinatario_tipo: 'usuario',
      destinatario_id: prestamo.usuario_id,
      tipo: 'devolucion_confirmada',
      titulo: 'Devolución registrada',
      mensaje: `Tu devolución de "${item.recurso_titulo}" ha sido registrada.`,
      referencia_tipo: 'prestamo',
      referencia_id: prestamo._id,
      creado_en: new Date()
    }).catch(() => null);

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

    const ext = archivo.tipo === 'url' ? 'html' : archivo.tipo;

    // Nombre de descarga limpio: sin caracteres especiales
    const nombreLimpio = recurso.titulo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .trim()
      .replace(/\s+/g, '_');

    const filename = `${nombreLimpio}.${ext}`;

    // Redirigir directamente a la URL de Cloudinary
    // El flag attachment en Cloudinary ya garantiza el nombre correcto
    return res.redirect(archivo.url);

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

    // Redirigir a Cloudinary — el flag attachment ya viene configurado desde la subida
    return res.redirect(archivo.url);

  } catch (error) {
    next(error);
  }
};