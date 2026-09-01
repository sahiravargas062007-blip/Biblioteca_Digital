const { validationResult } = require('express-validator');
const Categoria = require('../../../models/Categoria');
const Ejemplar  = require('../../../models/Ejemplar');
const Recurso   = require('../../../models/Recurso');
const Configuracion = require('../../../models/Configuracion');
const { subirBuffer, eliminar } = require('../../../services/cloudinaryService');
const { generarPublicId, flash, UPLOAD_PRESET } = require('./helpers');
const {
  buildRecursoPayload,
  crearEjemplaresParaRecurso,
} = require('./payload');

async function sincronizarFisicoConEjemplares(recursoId) {
  const [total, disponibles] = await Promise.all([
    Ejemplar.countDocuments({ recurso_id: recursoId }),
    Ejemplar.countDocuments({ recurso_id: recursoId, estado: 'Disponible' }),
  ]);

  await Recurso.findByIdAndUpdate(recursoId, {
    $set: {
      'fisico.total_ejemplares': total,
      'fisico.ejemplares_disponibles': disponibles,
      actualizado_en: new Date(),
    },
  });
}

exports.detalle = async (req, res, next) => {
  try {
    const [recurso, ejemplares] = await Promise.all([
      Recurso.findById(req.params.id).lean(),
      Ejemplar.find({ recurso_id: req.params.id }).sort({ codigo_inventario: 1 }).lean(),
    ]);

    if (!recurso) {
      flash(req, 'error', 'El recurso no existe.');
      return res.redirect('/admin/recursos');
    }

    return res.render('admin/recursos/detalle', {
      title: 'Detalle recurso', recurso, ejemplares,
    });
  } catch (error) {
    next(error);
  }
};

exports.editar = async (req, res, next) => {
  try {
    const [recurso, categorias, config] = await Promise.all([
      Recurso.findById(req.params.id).lean(),
      Categoria.find({ activa: true }).sort({ nombre: 1 }).lean(),
      Configuracion.findOne().lean()
    ]);

    if (!recurso) {
      flash(req, 'error', 'El recurso no existe.');
      return res.redirect('/admin/recursos');
    }

    return res.render('admin/recursos/nuevo', {
      title: 'Editar recurso', recurso, categorias, config,
      pageClass: 'admin-resource-form-page'
    });
  } catch (error) {
    next(error);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      flash(req, 'error', errors.array()[0].msg);
      return res.redirect('/admin/recursos/nuevo');
    }

    const payload    = await buildRecursoPayload(req);
    payload.creado_en = new Date();
    const recurso    = await Recurso.create(payload);
    const cantidad   = payload.fisico?.total_ejemplares || 0;
    await crearEjemplaresParaRecurso(recurso, cantidad);
    if (payload.fisico) {
      await sincronizarFisicoConEjemplares(recurso._id);
    }

    flash(req, 'success', 'Recurso creado correctamente.');
    return res.redirect(`/admin/recursos/${recurso._id}`);
  } catch (error) {
    if (error.isValidationError === true) {
      flash(req, 'error', error.message);
      return res.redirect('/admin/recursos/nuevo');
    }
    next(error);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const payload         = await buildRecursoPayload(req);
    const recursoAnterior = await Recurso.findById(req.params.id);
    if (!recursoAnterior) {
      flash(req, 'error', 'El recurso no existe.');
      return res.redirect('/admin/recursos');
    }
    
    if (payload.digital && payload.digital.archivos && payload.digital.archivos.length > 0) {
        const payloadUrl = payload.digital.archivos[0].url;
        const mainAnterior = recursoAnterior.digital?.archivos?.find(a => a.es_principal) || recursoAnterior.digital?.archivos?.[0];
        
        // If the URL hasn't changed, preserve the existing files (important for audiobooks with multiple chapters)
        if (mainAnterior && mainAnterior.url === payloadUrl) {
            payload.digital.archivos = recursoAnterior.digital.archivos;
        }
    }


    await Recurso.findByIdAndUpdate(req.params.id, payload, { runValidators: true });

    const nuevaCantidad      = payload.fisico?.total_ejemplares || 0;
    const ejemplaresActuales = await Ejemplar.countDocuments({ recurso_id: req.params.id });
    if (nuevaCantidad > ejemplaresActuales) {
      await crearEjemplaresParaRecurso(
        { ...recursoAnterior.toObject(), ...payload, _id: recursoAnterior._id },
        nuevaCantidad - ejemplaresActuales
      );
    }
    if (payload.fisico) {
      await sincronizarFisicoConEjemplares(req.params.id);
    }

    flash(req, 'success', 'Recurso actualizado correctamente.');
    return res.redirect(`/admin/recursos/${req.params.id}`);
  } catch (error) {
    if (error.isValidationError === true) {
      flash(req, 'error', error.message);
      return res.redirect(`/admin/recursos/${req.params.id}/editar`);
    }
    next(error);
  }
};

exports.actualizarPortada = async (req, res, next) => {
  try {
    const recurso = await Recurso.findById(req.params.id);
    if (!recurso) {
      return res.status(404).json({ success: false, message: 'El recurso no existe.' });
    }

    const imagenFile = req.file;
    if (!imagenFile) {
      return res.status(400).json({ success: false, message: 'No se recibió ninguna imagen.' });
    }

    // Subir a Cloudinary
    const publicId = generarPublicId(recurso.titulo, 'portadas');
    const result = await subirBuffer(imagenFile.buffer, {
      resource_type: 'image',
      public_id:     publicId,
      upload_preset: UPLOAD_PRESET,
    });

    // Eliminar portada anterior de Cloudinary si no es la default/placeholder
    if (recurso.imagen && recurso.imagen.public_id && !recurso.imagen.es_default) {
      await eliminar(recurso.imagen.public_id).catch(err => {
        console.error('[Cloudinary] Error al eliminar imagen anterior:', err);
      });
    }

    // Actualizar en BD
    const nuevaImagen = { url: result.secure_url, public_id: result.public_id, es_default: false };
    await Recurso.findByIdAndUpdate(req.params.id, {
      $set: { imagen: nuevaImagen, actualizado_en: new Date() }
    });

    return res.json({ success: true, url: result.secure_url });
  } catch (error) {
    console.error('[actualizarPortada] Error:', error);
    return res.status(500).json({ success: false, message: 'Error interno al actualizar la portada.' });
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    await Promise.all([
      Recurso.findByIdAndDelete(req.params.id),
      Ejemplar.deleteMany({ recurso_id: req.params.id }),
    ]);
    flash(req, 'success', 'Recurso eliminado correctamente.');
    return res.redirect('/admin/recursos');
  } catch (error) {
    next(error);
  }
};
