const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

/**
 * Levanta un MongoDB en memoria y conecta mongoose a él, y deja la URI
 * en process.env.MONGODB_URI (la usa config/session.js vía connect-mongo).
 * Cada test suite que necesite base de datos debe llamar a esto en
 * beforeAll() y a cerrarConexion() en afterAll().
 */
async function conectar() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
}

/**
 * Borra todas las colecciones. Útil en beforeEach() para aislar tests
 * entre sí sin tener que recrear el servidor completo cada vez.
 */
async function limpiar() {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  );
}

async function cerrarConexion() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongoServer) await mongoServer.stop();
}

module.exports = { conectar, limpiar, cerrarConexion };

// 3. Después de TODAS las pruebas: CERRAR CONEXIONES Y DETENER MONGO
afterAll(async () => {
  // Primero desconectar Mongoose
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }

  // Luego apagar la BD en memoria
  if (mongoServer) {
    await mongoServer.stop();
  }
});
