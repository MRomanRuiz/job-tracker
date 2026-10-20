
const fs = require('node:fs/promises');
const path = require('node:path');

const DATA_DIR = path.resolve(
  process.env.JSON_DATA_DIR ||
    path.join(__dirname, '../../client/data'),
);

const FILES = {
  applications: ['jobs.json', 'applications'],
  contacts: ['contacts.json', 'contacts'],
};

const queues = new Map();

async function readData(name) {
  const [filename, key] = FILES[name];
  const data = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, filename), 'utf8'),
  );

  if (!Array.isArray(data[key])) {
    throw new TypeError(`${filename} no contiene "${key}"`);
  }

  return data;
}

async function writeData(name, data) {
  const [filename] = FILES[name];
  const file = path.join(DATA_DIR, filename);
  const temp = `${file}.${process.pid}.tmp`;

  await fs.writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(temp, file);
}

function serialize(name, operation) {
  const previous = queues.get(name) || Promise.resolve();
  const current = previous.then(operation);

  queues.set(name, current.catch(() => {}));

  return current;
}

function collectionKey(name) {
  if (!FILES[name]) {
    throw new Error(`Colección JSON no soportada: ${name}`);
  }

  return FILES[name][1];
}

function createJSONStorage() {
  return {
    async list(name) {
      const data = await readData(name);
      return data[collectionKey(name)];
    },

    async getById(name, id) {
      const records = await this.list(name);
      return records.find(item => item.id === Number(id)) || null;
    },

    async create(name, record) {
      return serialize(name, async () => {
        const data = await readData(name);
        const key = collectionKey(name);
        const records = data[key];

        const maxId = records.reduce(
          (max, item) => Math.max(max, Number(item.id) || 0),
          0,
        );

        const newRecord = {
          ...record,
          id: Math.max(Date.now(), maxId + 1),
        };

        records.push(newRecord);
        await writeData(name, data);

        return newRecord;
      });
    },

    async update(name, id, changes) {
      return serialize(name, async () => {
        const data = await readData(name);
        const records = data[collectionKey(name)];
        const record = records.find(
          item => item.id === Number(id),
        );

        if (!record) {
            return null;
        }

        Object.assign(record, changes);
        await writeData(name, data);

        return record;
      });
    },

    async updatePending(name, id, dateField, date, changes) {
      return serialize(name, async () => {
        const data = await readData(name);
        const records = data[collectionKey(name)];

        const record = records.find(
          item =>
            item.id === Number(id) &&
            item.status === 'pending' &&
            item[dateField] === date,
        );

        if (!record) {
          return null;
        }

        Object.assign(record, changes);
        await writeData(name, data);

        return record;
      });
    },
  };
}

module.exports = { createJSONStorage };
