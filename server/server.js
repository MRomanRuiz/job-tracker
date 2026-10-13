const { createApp } = require('./app');
const { connectDB, closeDB } = require('./db');
require('dotenv').config();

const DEFAULT_PORT = 3001;
const PORT = process.env.PORT || DEFAULT_PORT;
let server;

async function closeServer(serverInstance) {
  if (!serverInstance) {
    return;
  }

  await new Promise((resolve, reject) => {
    serverInstance.close(error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function closeDatabaseSafely() {
  try {
    await closeDB();
  } catch (error) {
    console.info('Error al cerrar MongoDB:', error.message);
  }
}

async function shutdown() {
  console.info('\nCerrando servidor...');

  try {
    await closeServer(server);
    await closeDB();

    console.info('Servidor y MongoDB cerrados correctamente.');
    process.exitCode = 0;
  } catch (error) {
    console.info('Error durante el cierre:', error);
    process.exitCode = 1;
  }
}

async function startServer() {
  try {
    await connectDB();

    const app = createApp();

    server = app.listen(PORT, () => {
      console.info(`Servidor funcionando en http://localhost:${PORT}`);
    });

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    console.info('Error al iniciar el servidor:', error.message);
    await closeDatabaseSafely();
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void startServer();
}
