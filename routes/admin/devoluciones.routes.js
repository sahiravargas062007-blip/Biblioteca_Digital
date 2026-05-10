const router = require('express').Router();
const controller = require('../../controllers/admin/devolucionController');
const isAdminAuth = require('../../middlewares/isAdminAuth');

router.use(isAdminAuth);
router.post('/', controller.crear);

module.exports = router;
