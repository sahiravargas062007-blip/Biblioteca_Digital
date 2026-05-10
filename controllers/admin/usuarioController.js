const Usuario = require('../../models/Usuario');
const Notificacion = require('../../models/Notificacion');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

exports.index = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const estado = String(req.query.estado || '').trim();
    const filtro = {};

    if (q) {
      filtro.$or = [
        { nombre: new RegExp(q, 'i') },
        { documento: new RegExp(q, 'i') },
        { correo: new RegExp(q, 'i') },
        { programa_formacion: new RegExp(q, 'i') },
        { ficha: new RegExp(q, 'i') }
      ];
    }

    if (estado) filtro.estado = estado;

    const usuarios = await Usuario.find(filtro).sort({ estado: -1, creado_en: -1 }).lean();
    res.render('admin/usuarios/index', {
      title: 'Usuarios',
      usuarios,
      filtros: { q, estado }
    });
  } catch (error) {
    next(error);
  }
};

exports.aprobar = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) {
      flash(req, 'error', 'El usuario no existe.');
      return res.redirect('/admin/usuarios');
    }

    usuario.estado = 'Activo';
    usuario.aprobado_por = req.session.adminId;
    usuario.aprobado_en = new Date();
    usuario.actualizado_en = new Date();
    await usuario.save();

    await Notificacion.create({
      destinatario_tipo: 'usuario',
      destinatario_id: usuario._id,
      tipo: 'acceso_aprobado',
      titulo: 'Acceso aprobado',
      mensaje: 'Su acceso a la Biblioteca Digital fue aprobado.',
      referencia_tipo: 'usuario',
      referencia_id: usuario._id,
      creado_en: new Date()
    });

    flash(req, 'success', 'Usuario aprobado correctamente.');
    return res.redirect('/admin/usuarios');
  } catch (error) {
    next(error);
  }
};

exports.rechazar = async (req, res, next) => {
  try {
    const usuario = await Usuario.findByIdAndUpdate(req.params.id, {
      estado: 'Rechazado',
      actualizado_en: new Date()
    }, { new: true });

    if (!usuario) {
      flash(req, 'error', 'El usuario no existe.');
      return res.redirect('/admin/usuarios');
    }

    flash(req, 'success', 'Usuario rechazado correctamente.');
    return res.redirect('/admin/usuarios');
  } catch (error) {
    next(error);
  }
};

exports.suspender = async (req, res, next) => {
  try {
    await Usuario.findByIdAndUpdate(req.params.id, {
      estado: 'Suspendido',
      actualizado_en: new Date()
    });
    flash(req, 'success', 'Usuario suspendido.');
    return res.redirect('/admin/usuarios');
  } catch (error) {
    next(error);
  }
};
