const xlsx = require('xlsx');
const Categoria = require('../../models/Categoria');
const Recurso = require('../../models/Recurso');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

function normalizarSubcategorias(body) {
  const nombres = Array.isArray(body.sub_nombre) ? body.sub_nombre : [body.sub_nombre].filter(Boolean);
  const codigos = Array.isArray(body.sub_codigo_dewey) ? body.sub_codigo_dewey : [body.sub_codigo_dewey].filter(Boolean);
  const descripciones = Array.isArray(body.sub_descripcion) ? body.sub_descripcion : [body.sub_descripcion].filter(Boolean);

  return nombres
    .map((nombre, index) => ({
      nombre: String(nombre || '').trim(),
      codigo_dewey: String(codigos[index] || '').trim(),
      descripcion: String(descripciones[index] || '').trim()
    }))
    .filter((subcategoria) => subcategoria.nombre);
}

function buildCategoriaPayload(body) {
  return {
    nombre: String(body.nombre || '').trim(),
    codigo_dewey: String(body.codigo_dewey || '').trim(),
    descripcion: String(body.descripcion || '').trim(),
    activa: body.activa !== 'false',
    subcategorias: normalizarSubcategorias(body),
    actualizado_en: new Date()
  };
}

exports.index = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const filtro = q
      ? {
          $or: [
            { nombre: new RegExp(q, 'i') },
            { codigo_dewey: new RegExp(q, 'i') },
            { 'subcategorias.nombre': new RegExp(q, 'i') },
            { 'subcategorias.codigo_dewey': new RegExp(q, 'i') }
          ]
        }
      : {};

    const categorias = await Categoria.find(filtro).sort({ nombre: 1 }).lean();
    res.render('admin/categorias/index', {
      title: 'Categorías',
      categorias,
      q
    });
  } catch (error) {
    next(error);
  }
};

exports.formulario = async (req, res, next) => {
  try {
    const categoria = req.params.id
      ? await Categoria.findById(req.params.id).lean()
      : null;

    if (req.params.id && !categoria) {
      flash(req, 'error', 'La categoría no existe.');
      return res.redirect('/admin/categorias');
    }

    return res.render('admin/categorias/formulario', {
      title: categoria ? 'Editar categoría' : 'Nueva categoría',
      categoria
    });
  } catch (error) {
    next(error);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const payload = buildCategoriaPayload(req.body);
    payload.creado_en = new Date();

    if (!payload.nombre) {
      flash(req, 'error', 'El nombre de la categoría es obligatorio.');
      return res.redirect('/admin/categorias/nueva');
    }

    await Categoria.create(payload);
    flash(req, 'success', 'Categoría creada correctamente.');
    return res.redirect('/admin/categorias');
  } catch (error) {
    if (error.code === 11000) {
      flash(req, 'error', 'Ya existe una categoría con ese nombre.');
      return res.redirect('/admin/categorias/nueva');
    }
    next(error);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const payload = buildCategoriaPayload(req.body);

    if (!payload.nombre) {
      flash(req, 'error', 'El nombre de la categoría es obligatorio.');
      return res.redirect(`/admin/categorias/${req.params.id}/editar`);
    }

    await Categoria.findByIdAndUpdate(req.params.id, payload, { runValidators: true });
    flash(req, 'success', 'Categoría actualizada correctamente.');
    return res.redirect('/admin/categorias');
  } catch (error) {
    if (error.code === 11000) {
      flash(req, 'error', 'Ya existe una categoría con ese nombre.');
      return res.redirect(`/admin/categorias/${req.params.id}/editar`);
    }
    next(error);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    const asociada = await Recurso.exists({ 'categorias.categoria_id': req.params.id });

    if (asociada) {
      flash(req, 'error', 'No se puede eliminar: la categoría tiene recursos asociados.');
      return res.redirect('/admin/categorias');
    }

    await Categoria.findByIdAndDelete(req.params.id);
    flash(req, 'success', 'Categoría eliminada correctamente.');
    return res.redirect('/admin/categorias');
  } catch (error) {
    next(error);
  }
};

exports.importarExcel = async (req, res, next) => {
  try {
    if (!req.file) {
      flash(req, 'error', 'Debe seleccionar un archivo Excel.');
      return res.redirect('/admin/categorias');
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    let categoriasCreadas = 0;
    let subcategoriasCreadas = 0;

    for (const row of rows) {
      const nombreCategoria = String(row.categoria || '').trim();
      if (!nombreCategoria) continue;

      let categoria = await Categoria.findOne({ nombre: nombreCategoria });

      if (!categoria) {
        categoria = await Categoria.create({
          nombre: nombreCategoria,
          codigo_dewey: String(row.codigo_categoria || '').trim(),
          descripcion: '',
          subcategorias: [],
          total_recursos: 0,
          activa: true,
          creado_en: new Date(),
          actualizado_en: new Date()
        });
        categoriasCreadas += 1;
      }

      const nombreSubcategoria = String(row.subcategoria || '').trim();
      if (!nombreSubcategoria) continue;

      const existeSubcategoria = categoria.subcategorias.some((subcategoria) => (
        subcategoria.nombre.toLowerCase() === nombreSubcategoria.toLowerCase()
      ));

      if (!existeSubcategoria) {
        categoria.subcategorias.push({
          nombre: nombreSubcategoria,
          codigo_dewey: String(row.codigo_subcategoria || '').trim(),
          descripcion: ''
        });
        categoria.actualizado_en = new Date();
        await categoria.save();
        subcategoriasCreadas += 1;
      }
    }

    flash(req, 'success', `Importación completada. Categorías nuevas: ${categoriasCreadas}. Subcategorías nuevas: ${subcategoriasCreadas}.`);
    return res.redirect('/admin/categorias');
  } catch (error) {
    next(error);
  }
};
