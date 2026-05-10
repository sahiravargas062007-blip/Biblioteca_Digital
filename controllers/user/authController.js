const bcrypt = require('bcryptjs');
const Usuario = require('../../models/Usuario');
const Administrador = require('../../models/Administrador');
const Notificacion = require('../../models/Notificacion');
const ldapService = require('../../services/ldapService');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

exports.loginForm = (req, res) => res.render('auth/loginUsuario', { title: 'Ingreso usuarios' });

exports.login = async (req, res, next) => {
  try {
    const correo = String(req.body.correo || '').toLowerCase().trim();
    const password = String(req.body.password || '');

    let usuario = await Usuario.findOne({ correo });

    if (usuario) {
      if (usuario.estado !== 'Activo') {
        flash(req, 'error', `Su usuario se encuentra en estado: ${usuario.estado}.`);
        return res.redirect('/login');
      }

      const passwordMatch = usuario.password_hash
        ? await bcrypt.compare(password, usuario.password_hash)
        : false;

      if (passwordMatch) {
        req.session.userId = String(usuario._id);
        req.session.rol = 'usuario';
        req.session.nombre = usuario.nombre;
        req.session.correo = usuario.correo;
        return res.redirect('/catalogo');
      }

      const ldapUser = await ldapService.buscarUsuario(correo, password);
      if (ldapUser) {
        usuario.password_hash = await bcrypt.hash(password, 12);
        usuario.actualizado_en = new Date();
        await usuario.save();

        req.session.userId = String(usuario._id);
        req.session.rol = 'usuario';
        req.session.nombre = usuario.nombre;
        req.session.correo = usuario.correo;
        return res.redirect('/catalogo');
      }

      flash(req, 'error', 'Credenciales inválidas.');
      return res.redirect('/login');
    }

    const ldapUser = await ldapService.buscarUsuario(correo, password);
    if (!ldapUser) {
      flash(req, 'error', 'No fue posible validar sus credenciales institucionales.');
      return res.redirect('/login');
    }

    usuario = await Usuario.create({
      ldap_uid: ldapUser.uid,
      nombre: ldapUser.nombre,
      documento: ldapUser.documento,
      tipo_documento: ldapUser.tipo_documento,
      correo: ldapUser.correo,
      programa_formacion: ldapUser.programa_formacion,
      ficha: ldapUser.ficha,
      estado: 'Pendiente de aprobación',
      password_hash: await bcrypt.hash(password, 12),
      prestamos_activos: 0,
      reservas_activas: 0,
      creado_en: new Date(),
      actualizado_en: new Date()
    });

    const admin = await Administrador.findOne({ activo: true }).sort({ creado_en: 1 });
    if (admin) {
      await Notificacion.create({
        destinatario_tipo: 'administrador',
        destinatario_id: admin._id,
        tipo: 'nuevo_usuario_pendiente',
        titulo: 'Nuevo usuario pendiente',
        mensaje: `${usuario.nombre} solicitó acceso a la biblioteca digital.`,
        referencia_tipo: 'usuario',
        referencia_id: usuario._id,
        creado_en: new Date()
      });
    }

    flash(req, 'success', 'Solicitud registrada. El administrador debe aprobar su acceso.');
    return res.redirect('/login');
  } catch (error) {
    if (error.code === 11000) {
      flash(req, 'error', 'Ya existe una solicitud asociada a este usuario.');
      return res.redirect('/login');
    }
    next(error);
  }
};

exports.logout = (req, res) => req.session.destroy(() => res.redirect('/login'));
