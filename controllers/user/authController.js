const bcrypt = require('bcryptjs');
const Usuario = require('../../models/Usuario');
const Administrador = require('../../models/Administrador');
const Notificacion = require('../../models/Notificacion');
const ldapService = require('../../services/ldapService');
const LdapUsuarioMock = require('../../models/LdapUsuarioMock');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const notifService = require('../../services/notificacionService');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

exports.loginForm = (req, res) => res.render('auth/login', { title: 'Iniciar sesión', layout: false });

exports.login = async (req, res, next) => {
  try {
    const correo = String(req.body.correo || '').toLowerCase().trim();
    const password = String(req.body.password || '');

    // 1. Check if it's an Admin
    const admin = await Administrador.findOne({ correo, activo: true });
    if (admin) {
      const validAdmin = await bcrypt.compare(password, admin.password_hash);
      if (validAdmin) {
        admin.ultimo_acceso = new Date();
        await admin.save();

        req.session.adminId = String(admin._id);
        req.session.rol = 'administrador';
        req.session.nombre = admin.nombre;
        req.session.correo = admin.correo;
        return res.redirect('/admin/dashboard');
      }
    }

    // 2. Check if it's a regular User
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

    const adminNotificacion = await Administrador.findOne({ activo: true }).sort({ creado_en: 1 });
    if (adminNotificacion) {
      try {
        await notifService.nuevoUsuarioPendiente(adminNotificacion._id, usuario.nombre, usuario._id);
      } catch (_e) { }
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

exports.forgotPasswordForm = (req, res) => res.render('auth/forgotPassword', { title: 'Recuperar contraseña', layout: false });

exports.forgotPassword = async (req, res, next) => {
  try {
    const correo = String(req.body.correo || '').toLowerCase().trim();
    
    // Check Admin
    let user = await Administrador.findOne({ correo, activo: true });
    let isUser = false;
    
    if (!user) {
      // Check normal User
      user = await Usuario.findOne({ correo });
      isUser = true;
    }
    
    if (!user) {
      // Check LDAP Mock for simulation
      user = await LdapUsuarioMock.findOne({ correo });
      if (user) isUser = true;
    }

    if (!user) {
      flash(req, 'error', 'No existe una cuenta con ese correo electrónico.');
      return res.redirect('/recuperar-password');
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Setup Nodemailer
    // In a real scenario, use process.env.SMTP_...
    // But since the user wants to test with sahiramvs162007@gmail.com, we should create a test account or use a mock if we don't have credentials.
    // For now, let's use ethereal or just console.log the link if we don't have real credentials.
    // Wait, let's setup a free test ethereal account if no SMTP is provided.
    
    let transporter;
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      // Create ethereal test account dynamically
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    }

    const resetUrl = `http://${req.headers.host}/reset-password/${token}`;
    
    const mailOptions = {
      from: '"BiblioNet" <noreply@biblionet.com>',
      to: correo,
      subject: 'Recuperación de contraseña - BiblioNet',
      text: `Has solicitado restablecer tu contraseña. \n\nPor favor, haz clic en el siguiente enlace para crear una nueva contraseña:\n\n${resetUrl}\n\nSi no solicitaste esto, ignora este correo y tu contraseña permanecerá sin cambios.\n`
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (!process.env.SMTP_HOST) {
      console.log('Mensaje de recuperación enviado: %s', nodemailer.getTestMessageUrl(info));
    }

    flash(req, 'success', 'Se ha enviado un correo con las instrucciones para restablecer tu contraseña.');
    return res.redirect('/login');

  } catch (error) {
    next(error);
  }
};

exports.resetPasswordForm = async (req, res, next) => {
  try {
    const token = req.params.token;
    
    // Check Admin
    let user = await Administrador.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) {
      // Check normal User
      user = await Usuario.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
    }
    
    if (!user) {
      // Check LDAP Mock
      user = await LdapUsuarioMock.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
    }

    if (!user) {
      flash(req, 'error', 'El enlace de recuperación es inválido o ha expirado.');
      return res.redirect('/recuperar-password');
    }

    res.render('auth/resetPassword', { title: 'Restablecer contraseña', token, layout: false });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const token = req.params.token;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      flash(req, 'error', 'Las contraseñas no coinciden.');
      return res.redirect(`/reset-password/${token}`);
    }

    // Check Admin
    let user = await Administrador.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) {
      // Check normal User
      user = await Usuario.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
    }

    if (!user) {
      // Check LDAP Mock
      user = await LdapUsuarioMock.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
    }

    if (!user) {
      flash(req, 'error', 'El enlace de recuperación es inválido o ha expirado.');
      return res.redirect('/recuperar-password');
    }

    user.password_hash = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    flash(req, 'success', 'Tu contraseña ha sido restablecida exitosamente. Ahora puedes iniciar sesión.');
    return res.redirect('/login');
  } catch (error) {
    next(error);
  }
};
