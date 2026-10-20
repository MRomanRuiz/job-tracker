
require('dotenv').config();

const { createApp } = require('./src/app');

const DEFAULT_PORT = 3001;
const PORT = process.env.PORT || DEFAULT_PORT;

let server;
let closeDB = async () => {};
let shuttingDown = false;

async function closeServer() {
  if (!server) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  console.info('\nCerrando servidor...');

  try {
    await closeServer();
    await closeDB();

    console.info('Servidor y almacenamiento cerrados correctamente.');
    process.exitCode = 0;
  } catch (error) {
    console.info('Error durante el cierre:', error);
    process.exitCode = 1;
  }
}

async function startServer() {
  const type = (process.env.STORAGE_TYPE || 'json').toLowerCase();

  if (!['json', 'mongodb'].includes(type)) {
    throw new Error(`STORAGE_TYPE no válido: ${type}`);
  }

  if (type === 'mongodb') {
    const database = require('./src/db');

    await database.connectDB();
    closeDB = database.closeDB;
  }

  const app = createApp();

  server = app.listen(PORT, () => {
    console.info(
      `Servidor funcionando en http://localhost:${PORT} (${type})`,
    );
  });

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return server;
}

if (require.main === module) {
  startServer().catch(async error => {
    console.info('Error al iniciar el servidor:', error);

    try {
      await closeDB();
    } catch (closeError) {
      console.info('Error al cerrar MongoDB:', closeError);
    }

    process.exitCode = 1;
  });
}

module.exports = { startServer };
