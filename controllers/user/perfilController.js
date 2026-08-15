const Usuario = require('../../models/Usuario');
const bcrypt = require('bcryptjs');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,20}$/;

exports.index = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.session.userId).lean();
    if (!usuario) {
      flash(req, 'error', 'Usuario no encontrado.');
      return res.redirect('/catalogo');
    }

    const perfilIncompleto = !usuario.documento;

    res.render('user/perfil/index', {
      title: 'Perfil',
      usuario,
      perfilIncompleto
    });
  } catch (error) {
    next(error);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const { telefono, documento, tipo_documento, programa_formacion, ficha } = req.body;
    const usuario = await Usuario.findById(req.session.userId);

    if (!usuario) {
      flash(req, 'error', 'Usuario no encontrado.');
      return res.redirect('/perfil');
    }

    if (telefono) usuario.telefono = String(telefono).trim();
    if (documento && !usuario.documento) usuario.documento = String(documento).trim();
    if (tipo_documento && !usuario.documento) usuario.tipo_documento = String(tipo_documento).trim();
    if (programa_formacion) usuario.programa_formacion = String(programa_formacion).trim();
    if (ficha) usuario.ficha = String(ficha).trim();

    usuario.actualizado_en = new Date();
    
    // Catch potential duplicate key error for documento
    try {
      await usuario.save();
      flash(req, 'success', 'Tu perfil ha sido actualizado correctamente.');
    } catch (dbError) {
      if (dbError.code === 11000 && dbError.keyPattern && dbError.keyPattern.documento) {
        flash(req, 'error', 'El documento de identidad ingresado ya está registrado por otro usuario.');
      } else {
        throw dbError;
      }
    }

    return res.redirect('/perfil');
  } catch (error) {
    next(error);
  }
};

exports.cambiarPassword = async (req, res, next) => {
  try {
    const { passwordActual, nuevaPassword, confirmarPassword } = req.body;
    const usuario = await Usuario.findById(req.session.userId);

    if (!usuario) {
      return res.redirect('/login');
    }

    if (nuevaPassword !== confirmarPassword) {
      flash(req, 'error', 'La nueva contraseña y la confirmación no coinciden.');
      return res.redirect('/perfil');
    }

    const isValid = await bcrypt.compare(passwordActual, usuario.password_hash);
    if (!isValid) {
      flash(req, 'error', 'La contraseña actual es incorrecta.');
      return res.redirect('/perfil');
    }

    if (!PASSWORD_REGEX.test(nuevaPassword)) {
      flash(req, 'error', 'La nueva contraseña debe tener entre 8 y 20 caracteres, una mayúscula, una minúscula, un número y un carácter especial.');
      return res.redirect('/perfil');
    }

    usuario.password_hash = await bcrypt.hash(nuevaPassword, 12);
    usuario.actualizado_en = new Date();
    await usuario.save();

    flash(req, 'success', 'Contraseña actualizada exitosamente.');
    res.redirect('/perfil');
  } catch (error) {
    next(error);
  }
};
