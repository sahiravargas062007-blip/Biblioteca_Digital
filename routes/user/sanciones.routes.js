const router = require('express').Router();
const controller = require('../../controllers/user/sancionController');
const isUserAuth = require('../../middlewares/isUserAuth');

router.use(isUserAuth);
router.get('/', controller.index);

module.exports = router;
