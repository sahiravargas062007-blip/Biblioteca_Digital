const { body } = require('express-validator');

module.exports = [
  body('titulo').trim().notEmpty().withMessage('El titulo es obligatorio.'),
  body('autor').trim().notEmpty().withMessage('El autor es obligatorio.'),
  body('descripcion').trim().notEmpty().withMessage('La descripcion es obligatoria.'),
  body('tipo_contenido').isIn(['Lectura', 'Audio', 'Video']).withMessage('Tipo de contenido invalido.'),
  body('tipo_naturaleza').isIn(['Digital', 'Físico', 'Mixto']).withMessage('Tipo de disponibilidad invalido.'),
  body('tipo_material').trim().notEmpty().withMessage('El tipo de material es obligatorio.')
];
