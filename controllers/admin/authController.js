const bcrypt = require('bcryptjs');
const Administrador = require('../../models/Administrador');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

exports.loginForm = (req, res) => {
  if (req.session) {
    delete req.session.userId;
    delete req.session.adminId;
    delete req.session.rol;
    delete req.session.nombre;
    delete req.session.correo;
  }
  return res.render('auth/loginAdmin', { title: 'Ingreso administrativo', layout: false });
};

exports.login = async (req, res, next) => {
  try {
    const correo = String(req.body.usuario || req.body.correo || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    const admin = await Administrador.findOne({ correo, activo: true });

    if (!admin) {
      flash(req, 'error', 'Credenciales inválidas.');
      return res.redirect('/admin/login');
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      flash(req, 'error', 'Credenciales inválidas.');
      return res.redirect('/admin/login');
    }

    admin.ultimo_acceso = new Date();
    await admin.save();

    req.session.adminId = String(admin._id);
    req.session.rol = 'administrador';
    req.session.nombre = admin.nombre;
    req.session.correo = admin.correo;

    return res.redirect('/admin/recursos');
  } catch (error) {
    next(error);
  }
};

exports.logout = (req, res) => req.session.destroy(() => res.redirect('/admin/login'));

