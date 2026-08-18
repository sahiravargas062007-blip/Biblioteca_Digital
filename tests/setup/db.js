const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

/**
 * Levanta MongoDB en memoria, conecta Mongoose y expone la URI para
 * connect-mongo. Cada suite propietaria debe llamar a conectar() en
 * beforeAll() y cerrarConexion() en afterAll().
 */
async function conectar() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
}

/** Borra las colecciones para aislar cada prueba. */
async function limpiar() {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  );
}

/** Cierra solo recursos que llegaron a inicializarse. */
async function cerrarConexion() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = undefined;
  }
}

module.exports = { conectar, limpiar, cerrarConexion };
