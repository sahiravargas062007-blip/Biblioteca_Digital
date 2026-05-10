const Configuracion = require('../../models/Configuracion');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

exports.index = async (req, res, next) => {
  try {
    let config = await Configuracion.findOne().lean();
    if (!config) {
      config = await Configuracion.create({});
    }

    res.render('admin/configuracion/index', {
      title: 'Configuración',
      config
    });
  } catch (error) {
    next(error);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const {
      max_prestamos_fisicos,
      dias_prestamo,
      dias_renovacion,
      max_renovaciones,
      dias_tolerancia,
      max_prestamos_digitales,
      duracion_digital,
      renovaciones_digitales,
      max_reservas,
      tiempo_reclamo_horas
    } = req.body;

    let config = await Configuracion.findOne();
    if (!config) {
      config = new Configuracion();
    }

    config.prestamos_fisicos.max_recursos_por_usuario = Number(max_prestamos_fisicos) || 3;
    config.prestamos_fisicos.dias_prestamo_defecto = Number(dias_prestamo) || 15;
    config.prestamos_fisicos.dias_renovacion = Number(dias_renovacion) || 7;
    config.prestamos_fisicos.max_renovaciones = Number(max_renovaciones) || 1;
    config.prestamos_fisicos.dias_tolerancia = Number(dias_tolerancia) || 2;

    config.prestamos_digitales.max_prestamos_por_usuario = Number(max_prestamos_digitales) || 5;
    config.prestamos_digitales.duracion_defecto_dias = Number(duracion_digital) || 7;
    config.prestamos_digitales.renovaciones_permitidas = Number(renovaciones_digitales) || 0;

    config.reservas.max_reservas_por_usuario = Number(max_reservas) || 3;
    config.reservas.tiempo_max_reclamo_horas = Number(tiempo_reclamo_horas) || 24;

    config.actualizado_por = req.session.adminId;
    config.actualizado_en = new Date();
    await config.save();

    flash(req, 'success', 'Configuración actualizada correctamente.');
    return res.redirect('/admin/configuracion');
  } catch (error) {
    next(error);
  }
};
