require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const LdapUsuarioMock = require('../models/LdapUsuarioMock');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const hash = await bcrypt.hash('123456', 12);
  
  await LdapUsuarioMock.findOneAndUpdate(
    { correo: 'sahiramvs162007@gmail.com' },
    {
      uid: 'sahira123',
      nombre: 'Sahira Vargas',
      documento: '1000000000',
      tipo_documento: 'CC',
      programa_formacion: 'Tecnólogo en Análisis y Desarrollo de Software',
      ficha: '2670000',
      tipo_usuario: 'Aprendiz',
      estado_sena: 'Activo',
      password_hash: hash
    },
    { upsert: true, new: true }
  );

  console.log('Sahira mock added successfully!');
  process.exit(0);
}

run().catch(console.error);
