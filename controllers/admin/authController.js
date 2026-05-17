const bcrypt = require('bcryptjs');
const Administrador = require('../../models/Administrador');
const Usuario = require('../../models/Usuario');
const Prestamo = require('../../models/Prestamo');
const Sancion = require('../../models/Sancion');
const reporteService = require('../../services/reporteService');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

exports.loginForm = (req, res) => res.render('auth/loginAdmin', { title: 'Ingreso administrativo', layout: false });

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

    return res.redirect('/admin/dashboard');
  } catch (error) {
    next(error);
  }
};

exports.dashboard = async (req, res, next) => {
  try {
    const resumenReportes = await reporteService.resumen();

    res.render('admin/dashboard', {
      title: 'Panel administrador',
      resumen: resumenReportes
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = (req, res) => req.session.destroy(() => res.redirect('/admin/login'));
