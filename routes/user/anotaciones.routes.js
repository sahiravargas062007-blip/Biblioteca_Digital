const router = require('express').Router();
const Anotacion = require('../../models/Anotacion');
const isUserAuth = require('../../middlewares/isUserAuth');

router.use(isUserAuth);

// Obtener todas las anotaciones de un recurso para el usuario activo
router.get('/:recurso_id', async (req, res) => {
  try {
    const anotaciones = await Anotacion.find({
      usuario_id: req.session.userId,
      recurso_id: req.params.recurso_id
    });
    res.json({ success: true, data: anotaciones });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo anotaciones' });
  }
});

// Guardar una nueva anotacion
router.post('/', async (req, res) => {
  try {
    const payload = { ...req.body, usuario_id: req.session.userId };
    const nueva = await Anotacion.create(payload);
    res.json({ success: true, data: nueva });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error guardando anotacion' });
  }
});

// Eliminar una anotacion
router.delete('/:id', async (req, res) => {
  try {
    await Anotacion.findOneAndDelete({
      _id: req.params.id,
      usuario_id: req.session.userId
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error eliminando anotacion' });
  }
});

module.exports = router;
