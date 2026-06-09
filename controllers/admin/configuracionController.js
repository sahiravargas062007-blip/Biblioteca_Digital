const Configuracion = require('../../models/Configuracion');
const Categoria = require('../../models/Categoria');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

exports.index = async (req, res, next) => {
  try {
    let config = await Configuracion.findOne().lean();
    if (!config) {
      config = await Configuracion.create({});
    }
    const categorias = await Categoria.find({ activa: true }).sort({ nombre: 1 }).lean();

    res.render('admin/configuracion/index', {
      title: 'Configuración',
      config,
      categorias
    });
  } catch (error) {
    next(error);
  }
};
exports.actualizar = async (req, res, next) => {
  try {
    console.log('[ConfiguracionController] Received Body:', req.body);
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
      tiempo_reclamo_horas,
      usuarios_simultaneos_digital,
      unidad_duracion_digital,
      cola_reservas_habilitada_digital,
      tiempo_max_espera_cola_dias_digital
    } = req.body;

    let config = await Configuracion.findOne();
    if (!config) {
      config = new Configuracion();
    }

    console.log('[ConfiguracionController] Found doc before modification:', config);

    config.prestamos_fisicos.max_recursos_por_usuario = Number(max_prestamos_fisicos) || 3;
    config.prestamos_fisicos.dias_prestamo_defecto = Number(dias_prestamo) || 15;
    config.prestamos_fisicos.dias_renovacion = Number(dias_renovacion) || 7;
    config.prestamos_fisicos.max_renovaciones = Number(max_renovaciones) || 1;
    config.prestamos_fisicos.dias_tolerancia = Number(dias_tolerancia) || 2;

    // Procesar tiempos por categoría / subcategoría
    let tiemposInput = req.body.tiempos_por_categoria || [];
    if (typeof tiemposInput === 'object' && !Array.isArray(tiemposInput)) {
      tiemposInput = Object.values(tiemposInput);
    }
    const tiemposValidados = [];

    for (const item of tiemposInput) {
      if (item && (item.habilitado === 'true' || item.habilitado === 'on')) {
        const subcategoriasValidadas = [];
        let subInput = item.subcategorias || [];
        if (typeof subInput === 'object' && !Array.isArray(subInput)) {
          subInput = Object.values(subInput);
        }
        for (const sub of subInput) {
          if (sub && (sub.habilitado === 'true' || sub.habilitado === 'on')) {
            subcategoriasValidadas.push({
              subcategoria_id: sub.subcategoria_id,
              subcategoria_nombre: sub.subcategoria_nombre,
              dias: Number(sub.dias) || 15
            });
          }
        }
        tiemposValidados.push({
          categoria_id: item.categoria_id,
          categoria_nombre: item.categoria_nombre,
          dias: Number(item.dias) || 15,
          subcategorias: subcategoriasValidadas
        });
      }
    }
    config.prestamos_fisicos.tiempos_por_categoria = tiemposValidados;

    config.prestamos_digitales.max_prestamos_por_usuario = Number(max_prestamos_digitales) || 5;
    config.prestamos_digitales.duracion_defecto_dias = Number(duracion_digital) || 7;
    config.prestamos_digitales.renovaciones_permitidas = Number(renovaciones_digitales) || 0;
    config.prestamos_digitales.usuarios_simultaneos = Number(usuarios_simultaneos_digital) || 1;
    config.prestamos_digitales.unidad_duracion = unidad_duracion_digital || 'dias';
    config.prestamos_digitales.reservas_habilitadas = cola_reservas_habilitada_digital === 'true';
    config.prestamos_digitales.tiempo_max_espera_cola_dias = Number(tiempo_max_espera_cola_dias_digital) || 30;

    config.reservas.max_reservas_por_usuario = Number(max_reservas) || 3;
    config.reservas.tiempo_max_reclamo_horas = Number(tiempo_reclamo_horas) || 24;

    // Parsear y validar las reglas de sanción
    let reglasInput = req.body.reglas || [];
    if (typeof reglasInput === 'object' && !Array.isArray(reglasInput)) {
      reglasInput = Object.values(reglasInput);
    }
    const reglasValidadas = [];

    for (let i = 0; i < reglasInput.length; i++) {
      const r = reglasInput[i];
      const tipoIncidencia = r.tipo_incidencia;
      const gravedad = r.gravedad;
      const tipoSancion = r.tipo_sancion || 'Advertencia';
      const diasSuspension = Number(r.dias_suspension) || 0;
      const suspensionAdicional = r.suspension_adicional === 'on' || r.suspension_adicional === 'true';

      if (tipoSancion === 'Suspensión') {
        if (!r.dias_suspension || Number(r.dias_suspension) <= 0) {
          flash(req, 'error', 'Define los días de suspensión para este nivel');
          return res.redirect('/admin/configuracion');
        }
      }

      if (tipoSancion === 'Reposición' && suspensionAdicional) {
        if (!r.dias_suspension || Number(r.dias_suspension) <= 0) {
          flash(req, 'error', 'Define los días si deseas agregar suspensión adicional, o desactiva la opción');
          return res.redirect('/admin/configuracion');
        }
      }

      reglasValidadas.push({
        tipo_incidencia: tipoIncidencia,
        gravedad: gravedad,
        tipo_sancion: tipoSancion,
        dias_suspension: tipoSancion === 'Advertencia' ? 0 : diasSuspension,
        suspension_adicional: tipoSancion === 'Reposición' ? suspensionAdicional : false
      });
    }

    config.sanciones.retraso_leve_max_dias = Number(req.body.retraso_leve_max_dias) || 3;
    config.sanciones.retraso_moderada_max_dias = Number(req.body.retraso_moderada_max_dias) || 7;
    config.sanciones.reglas = reglasValidadas;

    config.actualizado_por = req.session.adminId;
    config.actualizado_en = new Date();
    await config.save();
    console.log('[ConfiguracionController] Saved document successfully:', config);

    flash(req, 'success', 'Configuración actualizada correctamente.');
    return res.redirect('/admin/configuracion');
  } catch (error) {
    next(error);
  }
};
