require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Administrador = require('../models/Administrador');
const Categoria = require('../models/Categoria');
const Configuracion = require('../models/Configuracion');
const Ejemplar = require('../models/Ejemplar');
const JobLog = require('../models/JobLog');
const LdapUsuarioMock = require('../models/LdapUsuarioMock');
const Notificacion = require('../models/Notificacion');
const Prestamo = require('../models/Prestamo');
const Recurso = require('../models/Recurso');
const Reserva = require('../models/Reserva');
const Sancion = require('../models/Sancion');
const Usuario = require('../models/Usuario');

const models = [
  LdapUsuarioMock,
  Administrador,
  Usuario,
  Categoria,
  Recurso,
  Ejemplar,
  Prestamo,
  Reserva,
  Sancion,
  Notificacion,
  Configuracion,
  JobLog
];

const obsoleteCollections = [
  'administradors',
  'devolucions',
  'ejemplars',
  'formatos',
  'itemprestamos',
  'ldapusuariomocks',
  'licencias',
  'notificacions',
  'sancions',
  'sessions'
];

async function ensureCollection(name) {
  const exists = await mongoose.connection.db.listCollections({ name }).hasNext();
  if (!exists) await mongoose.connection.db.createCollection(name);
}

async function ensureCollections() {
  for (const name of obsoleteCollections) {
    const exists = await mongoose.connection.db.listCollections({ name }).hasNext();
    if (exists) await mongoose.connection.db.dropCollection(name);
  }

  for (const model of models) {
    await ensureCollection(model.collection.name);
    await model.syncIndexes();
  }

  await ensureCollection('sesiones');
}

async function seedAdmin() {
  const correo = process.env.SEED_ADMIN_EMAIL || 'admin@biblioteca.sena.edu.co';
  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'Admin123*', 12);

  const admin = await Administrador.findOneAndUpdate(
    { correo },
    {
      $setOnInsert: {
        nombre: 'Administrador Biblioteca SENA',
        correo,
        password_hash: passwordHash,
        activo: true,
        creado_en: new Date()
      }
    },
    { upsert: true, new: true }
  );

  return admin;
}

async function seedLdapMockUsers() {
  const passwordHash = await bcrypt.hash(process.env.SEED_LDAP_PASSWORD || 'Aprendiz123*', 12);

  const users = [
    {
      uid: 'juan.perez',
      correo: 'juan.perez@sena.edu.co',
      nombre: 'Juan David Pérez Gómez',
      documento: '1075890123',
      tipo_documento: 'CC',
      programa_formacion: 'ADSO',
      ficha: '2805525',
      tipo_usuario: 'Aprendiz',
      estado_sena: 'Activo',
      password_hash: passwordHash,
      creado_en: new Date('2025-01-01')
    },
    {
      uid: 'ana.torres',
      correo: 'ana.torres@sena.edu.co',
      nombre: 'Ana María Torres',
      documento: '1098765432',
      tipo_documento: 'CC',
      programa_formacion: 'Gestión Administrativa',
      ficha: '2805526',
      tipo_usuario: 'Aprendiz',
      estado_sena: 'Activo',
      password_hash: passwordHash,
      creado_en: new Date('2025-01-01')
    }
  ];

  for (const user of users) {
    await LdapUsuarioMock.updateOne(
      { uid: user.uid },
      { $setOnInsert: user },
      { upsert: true }
    );
  }
}

async function seedCategorias() {
  await Categoria.deleteOne({ nombre: 'Tecnologia' });

  const categorias = [
    {
      nombre: 'Tecnología',
      codigo_dewey: '600',
      descripcion: 'Recursos relacionados con ciencias aplicadas y tecnología',
      subcategorias: [
        {
          nombre: 'Programación',
          codigo_dewey: '005.1',
          descripcion: 'Lenguajes y paradigmas de programación'
        },
        {
          nombre: 'Redes',
          codigo_dewey: '004.6',
          descripcion: 'Comunicaciones y redes de computadores'
        },
        {
          nombre: 'Bases de datos',
          codigo_dewey: '005.74',
          descripcion: 'Sistemas de gestión de bases de datos'
        }
      ],
      total_recursos: 0,
      activa: true,
      creado_en: new Date('2025-01-01'),
      actualizado_en: new Date('2025-01-01')
    },
    {
      nombre: 'Derecho',
      codigo_dewey: '340',
      descripcion: 'Leyes, normativas y documentos jurídicos',
      subcategorias: [
        {
          nombre: 'Legislación colombiana',
          codigo_dewey: '348',
          descripcion: 'Normas y legislación nacional'
        }
      ],
      total_recursos: 0,
      activa: true,
      creado_en: new Date('2025-01-01'),
      actualizado_en: new Date('2025-01-01')
    }
  ];

  for (const categoria of categorias) {
    await Categoria.updateOne(
      { nombre: categoria.nombre },
      { $setOnInsert: categoria },
      { upsert: true }
    );
  }
}

async function seedConfiguracion(admin) {
  const reglas = [
    ['Retraso', 'Leve', 'Advertencia', 0],
    ['Retraso', 'Moderada', 'Suspensión', 7],
    ['Retraso', 'Grave', 'Suspensión', 30],
    ['Daño', 'Leve', 'Advertencia', 0],
    ['Daño', 'Moderada', 'Suspensión', 15],
    ['Daño', 'Grave', 'Reposición', 0],
    ['Pérdida', 'Grave', 'Reposición', 0]
  ].map(([tipo_incidencia, gravedad, tipo_sancion, dias_suspension]) => ({
    tipo_incidencia,
    gravedad,
    tipo_sancion,
    dias_suspension
  }));

  await Configuracion.updateOne(
    {},
    {
      $setOnInsert: {
        prestamos_fisicos: {
          max_recursos_por_usuario: 3,
          dias_prestamo_defecto: 15,
          dias_renovacion: 7,
          max_renovaciones: 1,
          dias_tolerancia: 2,
          tiempos_por_categoria: []
        },
        prestamos_digitales: {
          max_prestamos_por_usuario: 5,
          duracion_defecto_dias: 7,
          renovaciones_permitidas: 0,
          reservas_habilitadas: true,
          tiempo_max_espera_cola_dias: 30,
          usuarios_simultaneos: 1,
          unidad_duracion: 'dias'
        },
        reservas: {
          max_reservas_por_usuario: 3,
          tiempo_max_reclamo_horas: 24
        },
        sanciones: {
          incluir_multas: false,
          reglas
        },
        actualizado_por: admin?._id,
        actualizado_en: new Date('2025-01-01')
      }
    },
    { upsert: true }
  );
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri);
  await ensureCollections();

  const admin = await seedAdmin();
  await seedLdapMockUsers();
  await seedCategorias();
  await seedConfiguracion(admin);

  const collections = await mongoose.connection.db.listCollections().toArray();
  const names = collections.map((collection) => collection.name).sort();

  console.log('Base de datos inicializada correctamente.');
  console.log(`MongoDB URI: ${uri}`);
  console.log(`Colecciones: ${names.join(', ')}`);
  console.log(`Admin: ${process.env.SEED_ADMIN_EMAIL || 'admin@biblioteca.sena.edu.co'} / ${process.env.SEED_ADMIN_PASSWORD || 'Admin123*'}`);
  console.log(`LDAP mock: juan.perez@sena.edu.co / ${process.env.SEED_LDAP_PASSWORD || 'Aprendiz123*'}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
