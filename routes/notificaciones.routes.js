const router       = require('express').Router();
const Notificacion = require('../models/Notificacion');
const isUserAuth   = require('../middlewares/isUserAuth');
const isAdminAuth  = require('../middlewares/isAdminAuth');

/* ── Usuario: obtener no leídas (JSON para el badge) ─────────────────── */
router.get('/api/notificaciones/usuario', isUserAuth, async (req, res) => {
  try {
    const notifs = await Notificacion.find({
      destinatario_tipo: 'usuario',
      destinatario_id:   req.session.userId,
      leida: false
    }).sort({ creado_en: -1 }).limit(20).lean();
    res.json({ total: notifs.length, items: notifs });
  } catch (err) {
    res.json({ total: 0, items: [] });
  }
});

/* ── Usuario: marcar como leída ──────────────────────────────────────── */
router.post('/api/notificaciones/usuario/:id/leer', isUserAuth, async (req, res) => {
  try {
    await Notificacion.findOneAndUpdate(
      { _id: req.params.id, destinatario_id: req.session.userId },
      { leida: true, leida_en: new Date() }
    );
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false });
  }
});

/* ── Admin: obtener no leídas ────────────────────────────────────────── */
router.get('/api/notificaciones/admin', isAdminAuth, async (req, res) => {
  try {
    const notifs = await Notificacion.find({
      destinatario_tipo: 'administrador',
      destinatario_id:   req.session.adminId,
      leida: false
    }).sort({ creado_en: -1 }).limit(20).lean();
    res.json({ total: notifs.length, items: notifs });
  } catch (err) {
    res.json({ total: 0, items: [] });
  }
});

/* ── Admin: marcar como leída ────────────────────────────────────────── */
router.post('/api/notificaciones/admin/:id/leer', isAdminAuth, async (req, res) => {
  try {
    await Notificacion.findOneAndUpdate(
      { _id: req.params.id, destinatario_id: req.session.adminId },
      { leida: true, leida_en: new Date() }
    );
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false });
  }
});

module.exports = router;
