const { body } = require('express-validator');

module.exports = [
  body('usuario_id').isMongoId().withMessage('Usuario inválido.'),
  body('ejemplar_ids').notEmpty().withMessage('Debe seleccionar al menos un ejemplar.')
];
