const fs = require('node:fs/promises');
const path = require('node:path');
const { prepareRecordUpdate } = require('../domain/recordHistory');

const FILES = {
  applications: ['jobs.json', 'applications'],
  contacts: ['contacts.json', 'contacts'],
};

const queues = new Map();
const initializationPromises = new Map();

async function ensureDataFile(name, dataDir) {
  const [filename, key] = FILES[name];
  const file = path.join(dataDir, filename);

  if (!initializationPromises.has(file)) {
    const initialization = (async () => {
      await fs.mkdir(dataDir, { recursive: true });

      try {
        await fs.writeFile(file, JSON.stringify({ [key]: [] }, null, 2), { flag: 'wx' });
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }
    })();

    initializationPromises.set(file, initialization);
  }

  try {
    await initializationPromises.get(file);
  } catch (error) {
    initializationPromises.delete(file);
    throw error;
  }
}

async function readData(name, dataDir) {
  const key = collectionKey(name);
  const [filename] = FILES[name];

  await ensureDataFile(name, dataDir);

  const data = JSON.parse(await fs.readFile(path.join(dataDir, filename), 'utf8'));

  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data[key])) {
    throw new TypeError(`${filename} does not contain "${key}"`);
  }

  return data;
}

async function listRecords(name, dataDir) {
  const data = await readData(name, dataDir);
  return data[collectionKey(name)];
}

async function writeData(name, dataDir, data) {
  const [filename] = FILES[name];
  const file = path.join(dataDir, filename);
  const temp = `${file}.${process.pid}.tmp`;

  await fs.writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(temp, file);
}

function serialize(dataDir, name, operation) {
  if (!queues.has(dataDir)) {
    queues.set(dataDir, new Map());
  }

  const directoryQueues = queues.get(dataDir);
  const previous = directoryQueues.get(name) || Promise.resolve();
  const current = previous.then(operation);

  directoryQueues.set(
    name,
    current.catch(() => {}),
  );

  return current;
}

function collectionKey(name) {
  if (!Object.hasOwn(FILES, name)) {
    throw new Error(`Unsupported JSON collection: ${name}`);
  }

  return FILES[name][1];
}

function createJSONStorage(
  dataDir = process.env.JSON_DATA_DIR || path.join(__dirname, '../../../client/data'),
) {
  const resolvedDataDir = path.resolve(dataDir);

  return {
    async list(name) {
      return listRecords(name, resolvedDataDir);
    },

    async getById(name, id) {
      const records = await listRecords(name, resolvedDataDir);
      const numericId = Number(id);

      return records.find(item => item.id === numericId) || null;
    },

    async create(name, record) {
      return serialize(resolvedDataDir, name, async () => {
        const data = await readData(name, resolvedDataDir);
        const key = collectionKey(name);
        const records = data[key];

        const maxId = records.reduce((max, item) => Math.max(max, item.id), 0);

        const now = new Date().toISOString();

        const newRecord = {
          ...record,
          id: maxId + 1,
          updatedAt: now,
          history: [],
        };

        records.push(newRecord);
        await writeData(name, resolvedDataDir, data);

        return newRecord;
      });
    },

    async update(name, id, changes) {
      return serialize(resolvedDataDir, name, async () => {
        const data = await readData(name, resolvedDataDir);
        const records = data[collectionKey(name)];
        const index = records.findIndex(item => item.id === Number(id));

        if (index === -1) {
          return null;
        }

        const current = records[index];
        const updated = prepareRecordUpdate(current, changes);

        if (updated === current) {
          return current;
        }

        records[index] = updated;
        await writeData(name, resolvedDataDir, data);

        return updated;
      });
    },

    async updateIfAlertable(
      name,
      id,
      dateField,
      date,
      expectedHistory,
      alertableStatuses,
      changes,
    ) {
      return serialize(resolvedDataDir, name, async () => {
        const data = await readData(name, resolvedDataDir);
        const records = data[collectionKey(name)];
        const expectedHistoryJSON = JSON.stringify(expectedHistory ?? []);

        const index = records.findIndex(
          item =>
            item.id === Number(id) &&
            alertableStatuses.includes(item.status) &&
            item[dateField] === date &&
            JSON.stringify(item.history ?? []) === expectedHistoryJSON,
        );

        if (index === -1) {
          return null;
        }

        const current = records[index];
        const updated = prepareRecordUpdate(current, changes);

        if (updated === current) {
          return current;
        }

        records[index] = updated;
        await writeData(name, resolvedDataDir, data);

        return updated;
      });
    },

    async delete(name, id) {
      return serialize(resolvedDataDir, name, async () => {
        const data = await readData(name, resolvedDataDir);
        const records = data[collectionKey(name)];
        const index = records.findIndex(item => item.id === Number(id));

        if (index === -1) {
          return false;
        }

        records.splice(index, 1);
        await writeData(name, resolvedDataDir, data);

        return true;
      });
    },
  };
}

module.exports = { createJSONStorage };
