const Categoria = require('../../../models/Categoria');
const Recurso   = require('../../../models/Recurso');
const Configuracion = require('../../../models/Configuracion');
const { buildCatalogFilter } = require('./payload');

exports.index = async (req, res, next) => {
  try {
    const { filtro, filtros } = buildCatalogFilter(req.query);

    const [recursos, categorias, resumen] = await Promise.all([
      Recurso.find(filtro).sort({ creado_en: -1 }).lean(),
      Categoria.find({ activa: true }).sort({ nombre: 1 }).lean(),
      require('../../../services/reporteService').resumen()
    ]);

    res.render('admin/recursos/index', {
      title: 'Materiales', recursos, categorias, resumen,
      filtros,
      pageClass: 'admin-catalog-page'
    });
  } catch (error) {
    next(error);
  }
};

exports.api = async (req, res, next) => {
  try {
    const { filtro } = buildCatalogFilter(req.query);
    const recursos = await Recurso.find(filtro).sort({ creado_en: -1 }).lean();

    return res.json(recursos.map((recurso) => ({
      _id: recurso._id,
      titulo: recurso.titulo,
      autor: recurso.autor,
      tipo_contenido: recurso.tipo_contenido,
      tipo_material: recurso.tipo_material,
      tipo_naturaleza: recurso.tipo_naturaleza,
      estado: recurso.estado,
      descripcion: recurso.descripcion,
      imagen: recurso.imagen,
      categorias: recurso.categorias
    })));
  } catch (error) {
    next(error);
  }
};

exports.nuevo = async (req, res, next) => {
  try {
    const [categorias, config] = await Promise.all([
      Categoria.find({ activa: true }).sort({ nombre: 1 }).lean(),
      Configuracion.findOne().lean()
    ]);
    res.render('admin/recursos/nuevo', {
      title: 'Nuevo recurso', recurso: null, categorias, config,
      pageClass: 'admin-resource-form-page'
    });
  } catch (error) {
    next(error);
  }
};
