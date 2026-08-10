const Usuario = require('../../models/Usuario');
const Notificacion = require('../../models/Notificacion');
const { esAjax, ok, fail } = require('../../utils/responder');

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

    const limitesPermitidos = [10, 20, 50];
    let limite = parseInt(req.query.limite, 10);
    if (!limitesPermitidos.includes(limite)) limite = 10;

    const totalRegistros = await Usuario.countDocuments(filtro);
    const totalPaginas = Math.max(Math.ceil(totalRegistros / limite), 1);

    let pagina = parseInt(req.query.pagina, 10) || 1;
    if (pagina < 1) pagina = 1;
    if (pagina > totalPaginas) pagina = totalPaginas;

    const usuarios = await Usuario.find(filtro)
      .sort({ estado: -1, creado_en: -1 })
      .skip((pagina - 1) * limite)
      .limit(limite)
      .lean();

    const datos = {
      usuarios,
      filtros: { q, estado },
      paginacion: { pagina, totalPaginas, limite, totalRegistros, limitesPermitidos }
    };

    // Petición de nuestro fetch(): solo el fragmento de tabla+paginación,
    // sin layout ni el resto de la página (evita recargar todo).
    if (esAjax(req)) {
      return res.render('admin/usuarios/_tabla', Object.assign({ layout: false }, datos));
    }

    res.render('admin/usuarios/index', Object.assign({
      title: 'Usuarios',
      pageClass: 'admin-users-page'
    }, datos));
  } catch (error) {
    next(error);
  }
};

exports.aprobar = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) {
      return fail(req, res, { redirect: '/admin/usuarios', message: 'El usuario no existe.' });
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

    return ok(req, res, {
      redirect: '/admin/usuarios',
      message: 'Usuario aprobado correctamente.',
      extra: { estado: usuario.estado }
    });
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
      return fail(req, res, { redirect: '/admin/usuarios', message: 'El usuario no existe.' });
    }

    return ok(req, res, {
      redirect: '/admin/usuarios',
      message: 'Usuario rechazado correctamente.',
      extra: { estado: usuario.estado }
    });
  } catch (error) {
    next(error);
  }
};

exports.suspender = async (req, res, next) => {
  try {
    const usuario = await Usuario.findByIdAndUpdate(req.params.id, {
      estado: 'Suspendido',
      actualizado_en: new Date()
    }, { new: true });

    if (!usuario) {
      return fail(req, res, { redirect: '/admin/usuarios', message: 'El usuario no existe.' });
    }

    return ok(req, res, {
      redirect: '/admin/usuarios',
      message: 'Usuario suspendido.',
      extra: { estado: usuario.estado }
    });
  } catch (error) {
    next(error);
  }
};
