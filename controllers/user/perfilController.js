const Usuario = require('../../models/Usuario');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

exports.index = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.session.userId).lean();
    if (!usuario) {
      flash(req, 'error', 'Usuario no encontrado.');
      return res.redirect('/catalogo');
    }

    res.render('user/perfil/index', {
      title: 'Perfil',
      usuario
    });
  } catch (error) {
    next(error);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const { telefono } = req.body;
    const usuario = await Usuario.findById(req.session.userId);

    if (!usuario) {
      flash(req, 'error', 'Usuario no encontrado.');
      return res.redirect('/perfil');
    }

    if (telefono) usuario.telefono = String(telefono).trim();
    usuario.actualizado_en = new Date();
    await usuario.save();

    flash(req, 'success', 'Tu perfil ha sido actualizado correctamente.');
    return res.redirect('/perfil');
  } catch (error) {
    next(error);
  }
};
