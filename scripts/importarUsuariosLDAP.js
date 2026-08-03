/**
 * Script de importación masiva de usuarios por LDAP Mock
 * Ficha: 3142784 | Programa: ADSO
 * Contraseña por defecto: 123456
 * 
 * Uso: node scripts/importarUsuariosLDAP.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const LdapUsuarioMock = require('../models/LdapUsuarioMock');

const usuarios = [
  { correo: 'jhonatancalderon2470@gmail.com',        documento: '1117784339', nombre: 'Jhonatan Castro Calderón',           tipo_documento: 'CC' },
  { correo: '2005luismorales2020@gmail.com',          documento: '1051065897', nombre: 'Luis Esteban Morales Gasca',         tipo_documento: 'CC' },
  { correo: 'manuelcardenassuarez2005@gmail.com',     documento: '1117496648', nombre: 'Manuel Andres Cardenas Suarez',      tipo_documento: 'CC' },
  { correo: 'dafevepe20030604@gmail.com',             documento: '1006510328', nombre: 'Daniel Felipe Vera Perdomo',         tipo_documento: 'CC' },
  { correo: 'juandavidtn4@gmail.com',                 documento: '1118368446', nombre: 'Juan David Trujillo Naranjo',        tipo_documento: 'TI' },
  { correo: 'stivenzambrano0208@gmail.com',           documento: '1117511568', nombre: 'Jhoan Steven Zambrano Vera',         tipo_documento: 'TI' },
  { correo: 'ortizpatrick750@gmail.com',              documento: '1118364706', nombre: 'Patrick Damian Ortiz Hernández',     tipo_documento: 'CC' },
  { correo: 'stefanycuellar217@gmail.com',            documento: '1117497987', nombre: 'Estefany cuellar anturi',            tipo_documento: 'CC' },
  { correo: 'gutierrez.rivera2008@gmail.com',         documento: '1118471476', nombre: 'Jaiber Julian Gutierrez Rivera',     tipo_documento: 'CC' },
  { correo: 'alejopmotta@gmail.com',                  documento: '1099742508', nombre: 'Jorge Alejandro Peña Motta',         tipo_documento: 'TI' },
  { correo: 'ingrijuliethgascatenorio@gmail.com',     documento: '1116205722', nombre: 'Ingri Julieth Gasca Tenorio',        tipo_documento: 'CC' },
  { correo: 'juliancr147025@gmail.com',               documento: '1084331945', nombre: 'Andrés Julián Cruz Hernández',       tipo_documento: 'CC' },
  { correo: 'cristiamejia155@gmail.com',              documento: '1006508852', nombre: 'Cristian Cantillo mejia',            tipo_documento: 'CC' },
  { correo: 'ibsensotart23@gmail.com',                documento: '1006508766', nombre: 'Ibsen Alexis Soto Artunduaga',       tipo_documento: 'CC' },
  { correo: 'bhoyos599@gmail.com',                    documento: '1006419673', nombre: 'Brayan Stiven hoyos cespedes',       tipo_documento: 'CC' },
  { correo: 'santiagolizcanossuarez@gmail.com',       documento: '1118367962', nombre: 'Santiago Lizcano Suárez',            tipo_documento: 'TI' },
  { correo: 'yefryserna2@gmail.com',                  documento: '1115942896', nombre: 'yefry serna puentes',                tipo_documento: 'CC' },
  { correo: 'anggiebernal1@gmail.com',                documento: '1120498200', nombre: 'Anggie Marcela Olmos Bernal',        tipo_documento: 'CC' },
  { correo: 'barreroromerowilliamsantiago@gmail.com', documento: '1122726863', nombre: 'William Santiago Barrero Romero',    tipo_documento: 'TI' },
  { correo: 'yuleinylugo71@gmail.com',                documento: '1117512328', nombre: 'Yuleiny Lugo Quimbayo',              tipo_documento: 'TI' },
  { correo: 'cuellarrondonp@gmail.com',               documento: '1116204178', nombre: 'Paula Daniela Cuellar Rondon',       tipo_documento: 'CC' },
  { correo: 'carvajal7lsch@gmail.com',                documento: '1080361991', nombre: 'Juan Sebastian Carvajal Home',       tipo_documento: 'TI' },
  { correo: 'brayanroa@icloud.com',                   documento: '1088255893', nombre: 'Brayan Steven Velázquez Roa',        tipo_documento: 'TI' },
  { correo: 'leiderfabianramoscano99@gmail.com',      documento: '1118471378', nombre: 'Leider Fabián Ramos Cano',           tipo_documento: 'TI' },
  { correo: 'yuliethjaramillo1916@gmail.com',         documento: '1117513057', nombre: 'Yessica Yulieth Jaramillo Herran',   tipo_documento: 'TI' },
  { correo: 'gustavoadolfocabrera15@gmail.com',       documento: '1118367954', nombre: 'Gustavo Adolfo Cabrera Vanegas',     tipo_documento: 'TI' },
  { correo: 'murciacorredoremerson@gmail.com',        documento: '1117811948', nombre: 'Emerson Corredor Murcia',            tipo_documento: 'TI' },
  { correo: 'sahiravargas162007@gmail.com',           documento: '1117931191', nombre: 'Sahira Mirleth Vargas Sánchez',      tipo_documento: 'CC' },
  { correo: 'maryjromero2904@gmail.com',              documento: '1130268455', nombre: 'Mary Jane Romero Rivas',             tipo_documento: 'TI' },
  { correo: 'isabelalopera75@gmail.com',              documento: '1118368430', nombre: 'Isabella Lopera',                    tipo_documento: 'TI' },
];

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const passwordHash = await bcrypt.hash('123456', 12);

    let creados = 0;
    let actualizados = 0;
    let errores = 0;

    for (const u of usuarios) {
      try {
        // Generar uid basado en el documento
        const uid = `user_${u.documento}`;

        const result = await LdapUsuarioMock.findOneAndUpdate(
          { correo: u.correo },
          {
            uid,
            nombre: u.nombre,
            documento: u.documento,
            tipo_documento: u.tipo_documento,
            programa_formacion: 'ADSO',
            ficha: '3142784',
            tipo_usuario: 'Aprendiz',
            estado_sena: 'Activo',
            password_hash: passwordHash
          },
          { upsert: true, new: true, rawResult: true }
        );

        if (result.lastErrorObject?.updatedExisting) {
          actualizados++;
          console.log(`🔄 Actualizado: ${u.nombre} (${u.correo})`);
        } else {
          creados++;
          console.log(`✅ Creado: ${u.nombre} (${u.correo})`);
        }
      } catch (err) {
        errores++;
        console.error(`❌ Error con ${u.nombre} (${u.correo}): ${err.message}`);
      }
    }

    console.log('\n══════════════════════════════════════════');
    console.log(`📊 Resumen de importación LDAP`);
    console.log(`   ✅ Creados:      ${creados}`);
    console.log(`   🔄 Actualizados: ${actualizados}`);
    console.log(`   ❌ Errores:      ${errores}`);
    console.log(`   📋 Total:        ${usuarios.length}`);
    console.log('══════════════════════════════════════════');
    console.log(`\n🔑 Contraseña por defecto: 123456`);
    console.log(`📚 Programa: ADSO | Ficha: 3142784`);

  } catch (err) {
    console.error('❌ Error fatal:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
