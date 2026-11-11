const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { MongoClient } = require('mongodb');
const newman = require('newman');
const dotenv = require('dotenv');

const ROOT_DIR = path.resolve(__dirname, '..');
const SERVER_PATH = path.join(ROOT_DIR, 'server', 'server.js');
const COLLECTION_PATH = path.join(ROOT_DIR, 'postman', 'job-tracker.postman_collection.json');
const TEST_ENV_PATH = path.join(ROOT_DIR, 'server', '.env.test');

const TEST_DATABASE = 'job_tracker_test';
const STARTUP_TIMEOUT = 15000;
const STARTUP_POLL_INTERVAL = 250;
const SERVER_STOP_TIMEOUT = 5000;

dotenv.config({
  path: TEST_ENV_PATH,
  override: false,
});

const storageType = (process.env.STORAGE_TYPE || 'mongodb').toLowerCase();

const { MONGODB_URI, MONGODB_DB } = process.env;

function validateConfig() {
  if (!['json', 'mongodb'].includes(storageType)) {
    throw new Error(`Invalid STORAGE_TYPE: "${storageType}". Use "json" or "mongodb".`);
  }

  if (storageType === 'mongodb') {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from server/.env.test');
    }

    if (MONGODB_DB !== TEST_DATABASE) {
      throw new Error(`Postman tests cancelled: MONGODB_DB must be "${TEST_DATABASE}".`);
    }
  }
}

async function dropTestDatabase() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    await client.db(TEST_DATABASE).dropDatabase();
    console.info(`Database "${TEST_DATABASE}" cleared.`);
  } finally {
    await client.close();
  }
}

function createJSONTestDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'job-tracker-postman-'));

  // Create empty test files. Never use the application's real data.
  fs.writeFileSync(
    path.join(directory, 'jobs.json'),
    JSON.stringify({ applications: [] }, null, 2),
  );

  fs.writeFileSync(
    path.join(directory, 'contacts.json'),
    JSON.stringify({ contacts: [] }, null, 2),
  );

  return directory;
}

async function getAvailablePort() {
  const server = net.createServer();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address();

  await new Promise((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  return port;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(server, url) {
  const deadline = Date.now() + STARTUP_TIMEOUT;

  async function poll() {
    if (server.spawnError) {
      throw server.spawnError;
    }

    if (server.exitCode !== null) {
      throw new Error(`API server exited unexpectedly with code ${server.exitCode}.`);
    }

    try {
      const response = await fetch(`${url}/api/applications`);

      if (response.ok) {
        console.info(`API ready at ${url} (${storageType})`);
        return response;
      }
    } catch {
      // The server may still be starting.
    }

    if (Date.now() >= deadline) {
      throw new Error(`API did not become ready within ${STARTUP_TIMEOUT} ms.`);
    }

    await delay(STARTUP_POLL_INTERVAL);
    return poll();
  }

  return poll();
}

function runNewman(serverUrl) {
  return new Promise((resolve, reject) => {
    newman.run(
      {
        collection: COLLECTION_PATH,
        reporters: 'cli',
        envVar: [
          {
            key: 'SERVER_URL',
            value: serverUrl,
          },
        ],
      },
      (error, summary) => {
        if (error) {
          reject(error);
          return;
        }

        if (summary?.run?.failures?.length > 0) {
          reject(new Error(`Newman finished with ${summary.run.failures.length} failure(s).`));
          return;
        }

        resolve();
      },
    );
  });
}

async function stopServer(server) {
  if (!server || server?.exitCode !== null || server?.signalCode !== null) {
    return;
  }

  await new Promise(resolve => {
    const timeout = setTimeout(() => {
      server.kill('SIGKILL');
    }, SERVER_STOP_TIMEOUT);

    server.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });

    server.kill('SIGTERM');
  });
}

async function main() {
  validateConfig();

  let server;
  let jsonTestDirectory;
  let testError;

  try {
    if (storageType === 'mongodb') {
      // Only the dedicated test database is cleared.
      await dropTestDatabase();
    } else {
      jsonTestDirectory = createJSONTestDirectory();
      console.info(`Temporary JSON storage: ${jsonTestDirectory}`);
    }

    const port = await getAvailablePort();
    const serverUrl = `http://127.0.0.1:${port}`;

    const serverEnv = {
      ...process.env,
      STORAGE_TYPE: storageType,
      PORT: String(port),
    };

    if (storageType === 'mongodb') {
      serverEnv.MONGODB_DB = TEST_DATABASE;
    } else {
      serverEnv.JSON_DATA_DIR = jsonTestDirectory;
    }

    server = spawn(process.execPath, [SERVER_PATH], {
      cwd: ROOT_DIR,
      env: serverEnv,
      stdio: 'inherit',
    });

    server.spawnError = null;

    server.on('error', error => {
      server.spawnError = error;
    });

    await waitForServer(server, serverUrl);
    await runNewman(serverUrl);

    console.info(`Postman tests passed (${storageType}).`);
  } catch (error) {
    testError = error;
  } finally {
    await stopServer(server);

    if (storageType === 'mongodb') {
      try {
        await dropTestDatabase();
        console.info('Postman test database cleaned up.');
      } catch (error) {
        console.info('Could not clean up the test database:', error);
        testError ??= error;
      }
    }

    if (jsonTestDirectory) {
      try {
        fs.rmSync(jsonTestDirectory, {
          recursive: true,
          force: true,
        });
        console.info('Temporary JSON storage cleaned up.');
      } catch (error) {
        console.info('Could not clean up temporary JSON storage:', error);
        testError ??= error;
      }
    }
  }

  if (testError) {
    throw testError;
  }
}

main().catch(error => {
  console.info('Postman tests failed:', error);
  process.exitCode = 1;
});
