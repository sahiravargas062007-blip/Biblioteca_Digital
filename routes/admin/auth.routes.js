const router = require('express').Router();
const controller = require('../../controllers/admin/authController');
const isAdminAuth = require('../../middlewares/isAdminAuth');

router.get('/login', (req, res) => res.redirect('/login'));

router.get('/', isAdminAuth, (req, res) => res.redirect('/admin/recursos'));
router.get('/dashboard', isAdminAuth, (req, res) => res.redirect('/admin/recursos'));
router.post('/logout', isAdminAuth, controller.logout);

module.exports = router;
