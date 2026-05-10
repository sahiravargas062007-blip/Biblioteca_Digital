const { body } = require('express-validator');

module.exports = [
  body('correo').isEmail().withMessage('Correo institucional invalido.'),
  body('telefono').optional({ checkFalsy: true }).trim().isLength({ min: 7 }).withMessage('Telefono invalido.')
];
