const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');

const { after, before, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('dotenv').config({
  path: path.join(__dirname, '..', '..', '.env.test'),
  override: false,
});

const { createStorage } = require('../../src/storage');
const { createJSONStorage } = require('../../src/storage/json');

const STORAGE_TYPE = (
  process.env.TEST_STORAGE_TYPE ||
  process.env.STORAGE_TYPE ||
  'json'
).toLowerCase();

const originalStorageType = process.env.STORAGE_TYPE;
const originalJSONDataDir = process.env.JSON_DATA_DIR;
let dataDir;
let jsonStorage;

const resetDataFiles = async () => {
  await Promise.all([
    fs.writeFile(
      path.join(dataDir, 'jobs.json'),
      JSON.stringify({
        applications: [{ id: 1, status: 'pending', appliedAt: '2026-01-01', notes: '' }],
      }),
      'utf8',
    ),
    fs.writeFile(path.join(dataDir, 'contacts.json'), JSON.stringify({ contacts: [] }), 'utf8'),
  ]);
};

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'job-tracker-storage-test-'));
  process.env.JSON_DATA_DIR = dataDir;
  jsonStorage = require('../../src/storage/json').createJSONStorage();
  await resetDataFiles();
});

beforeEach(async () => {
  await resetDataFiles();
});

after(async () => {
  if (originalStorageType === undefined) {
    delete process.env.STORAGE_TYPE;
  } else {
    process.env.STORAGE_TYPE = originalStorageType;
  }

  if (originalJSONDataDir === undefined) {
    delete process.env.JSON_DATA_DIR;
  } else {
    process.env.JSON_DATA_DIR = originalJSONDataDir;
  }

  if (dataDir) {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

describe('storage factory', () => {
  it('uses STORAGE_TYPE when no type is supplied', () => {
    process.env.STORAGE_TYPE = STORAGE_TYPE;

    assert.equal(typeof createStorage().list, 'function');
  });

  if (STORAGE_TYPE === 'json') {
    it('defaults to JSON when STORAGE_TYPE is not set', () => {
      delete process.env.STORAGE_TYPE;

      assert.equal(typeof createStorage().list, 'function');
    });

    it('selects MongoDB storage through its factory without connecting', () => {
      const mongoModulePath = require.resolve('../../src/storage/mongodb');
      const originalMongoModule = require.cache[mongoModulePath];
      const mongoStorage = { list() {} };

      require.cache[mongoModulePath] = {
        exports: { createMongoStorage: () => mongoStorage },
        loaded: true,
      };

      try {
        assert.equal(createStorage('mongodb'), mongoStorage);
      } finally {
        if (originalMongoModule) {
          require.cache[mongoModulePath] = originalMongoModule;
        } else {
          delete require.cache[mongoModulePath];
        }
      }
    });
  }

  it('rejects unsupported storage types', () => {
    assert.throws(
      () => createStorage('unsupported'),
      /Unsupported STORAGE_TYPE "unsupported"\. Use "json" or "mongodb"\./,
    );
  });

  it('rejects missing and non-string storage types', () => {
    for (const type of [null, '', '   ']) {
      assert.throws(() => createStorage(type), TypeError);
    }
  });
});

describe('JSON storage', () => {
  it('creates a missing data directory and empty collection files', async () => {
    const missingDataDir = path.join(dataDir, 'not-created-yet');
    const emptyStorage = createJSONStorage(missingDataDir);

    const [applications, contacts] = await Promise.all([
      emptyStorage.list('applications'),
      emptyStorage.list('contacts'),
    ]);

    assert.deepEqual(applications, []);
    assert.deepEqual(contacts, []);
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(missingDataDir, 'jobs.json'), 'utf8')),
      { applications: [] },
    );
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(missingDataDir, 'contacts.json'), 'utf8')),
      { contacts: [] },
    );
  });

  it('preserves existing JSON files when initialization receives EEXIST', async () => {
    const existingDataDir = path.join(dataDir, 'existing-data');
    await fs.mkdir(existingDataDir, { recursive: true });
    await fs.writeFile(
      path.join(existingDataDir, 'jobs.json'),
      JSON.stringify({ applications: [{ id: 7 }] }),
      'utf8',
    );

    const existingStorage = createJSONStorage(existingDataDir);

    assert.deepEqual(await existingStorage.list('applications'), [{ id: 7 }]);
  });

  it('retries file initialization after a non-EEXIST write error', async () => {
    const retryDataDir = path.join(dataDir, 'retry-data');
    const originalWriteFile = fs.writeFile;
    const retryStorage = createJSONStorage(retryDataDir);

    try {
      fs.writeFile = async () => {
        const error = new Error('Disk unavailable');
        error.code = 'EACCES';
        throw error;
      };

      await assert.rejects(retryStorage.list('applications'), /Disk unavailable/);

      fs.writeFile = originalWriteFile;
      assert.deepEqual(await retryStorage.list('applications'), []);
    } finally {
      fs.writeFile = originalWriteFile;
    }
  });

  it('uses an independent data directory for each storage instance', async () => {
    const firstDir = path.join(dataDir, 'first-instance');
    const secondDir = path.join(dataDir, 'second-instance');

    const firstStorage = createJSONStorage(firstDir);
    const secondStorage = createJSONStorage(secondDir);

    await firstStorage.create('applications', { company: 'Company A' });

    assert.equal((await firstStorage.list('applications')).length, 1);
    assert.deepEqual(await secondStorage.list('applications'), []);
  });

  it('handles concurrent writes in independent storage instances', async () => {
    const firstDir = path.join(dataDir, 'first-concurrent');
    const secondDir = path.join(dataDir, 'second-concurrent');

    const firstStorage = createJSONStorage(firstDir);
    const secondStorage = createJSONStorage(secondDir);

    const [first, second] = await Promise.all([
      firstStorage.create('applications', { company: 'Company A' }),
      secondStorage.create('applications', { company: 'Company B' }),
    ]);

    assert.equal(first.id, 1);
    assert.equal(second.id, 1);

    assert.deepEqual(
      (await firstStorage.list('applications')).map(record => record.company),
      ['Company A'],
    );

    assert.deepEqual(
      (await secondStorage.list('applications')).map(record => record.company),
      ['Company B'],
    );
  });

  it('returns null or false for missing records', async () => {
    assert.equal(await jsonStorage.getById('applications', 99), null);
    assert.equal(await jsonStorage.update('applications', 99, { notes: 'Missing' }), null);
    assert.equal(
      await jsonStorage.updateIfAlertable(
        'applications',
        1,
        'appliedAt',
        '2026-01-01',
        [{ field: 'status', changedAt: 'wrong' }],
        ['pending'],
        { status: 'suspended' },
      ),
      null,
    );
    assert.equal(await jsonStorage.delete('applications', 99), false);
  });

  it('does not rewrite records when an update has no effective changes', async () => {
    const application = await jsonStorage.update('applications', 1, { notes: '' });
    const pending = await jsonStorage.updateIfAlertable(
      'applications',
      1,
      'appliedAt',
      '2026-01-01',
      [],
      ['pending'],
      { status: 'pending' },
    );

    assert.equal(application.notes, '');
    assert.equal(pending.status, 'pending');
    assert.equal(application.updatedAt, undefined);
  });

  it('creates, updates, and deletes JSON records', async () => {
    const created = await jsonStorage.create('contacts', { contact: 'Eva' });
    assert.equal(typeof created.id, 'number');
    assert.deepEqual(created.history, []);

    const application = await jsonStorage.update('applications', 1, { notes: 'Follow up' });
    assert.equal(application.notes, 'Follow up');
    assert.deepEqual(application.history, []);

    const updated = await jsonStorage.updateIfAlertable(
      'applications',
      1,
      'appliedAt',
      '2026-01-01',
      [],
      ['pending'],
      { status: 'suspended' },
    );
    assert.equal(updated.status, 'suspended');
    assert.deepEqual(
      updated.history.map(event => event.field),
      ['status'],
    );
    assert.equal(await jsonStorage.delete('contacts', created.id), true);
  });

  it('rejects missing, malformed, and incorrectly shaped data files', async () => {
    await fs.unlink(path.join(dataDir, 'contacts.json'));
    await assert.rejects(jsonStorage.list('contacts'), /ENOENT/);

    await fs.writeFile(path.join(dataDir, 'jobs.json'), '{invalid', 'utf8');
    await assert.rejects(jsonStorage.list('applications'), SyntaxError);

    await fs.writeFile(
      path.join(dataDir, 'jobs.json'),
      JSON.stringify({ applications: {} }),
      'utf8',
    );
    await assert.rejects(jsonStorage.list('applications'), /does not contain "applications"/);
  });

  it('rejects unsupported JSON collections with a clear error', async () => {
    await assert.rejects(jsonStorage.list('unknown'), /Unsupported JSON collection: unknown/);
  });

  it('continues serial writes after a previous operation fails', async () => {
    await fs.writeFile(path.join(dataDir, 'jobs.json'), '{invalid', 'utf8');
    await assert.rejects(jsonStorage.create('applications', { company: 'Acme' }), SyntaxError);

    await resetDataFiles();
    const created = await jsonStorage.create('applications', { company: 'Acme' });

    assert.equal(created.company, 'Acme');
    assert.equal((await jsonStorage.list('applications')).length, 2);
  });

  it('generates sequential IDs for new records', async () => {
    const first = await jsonStorage.create('applications', {
      company: 'Company A',
      position: 'Developer',
    });

    const second = await jsonStorage.create('applications', {
      company: 'Company B',
      position: 'Designer',
    });

    assert.equal(second.id, first.id + 1);
  });

  it('works when called without the storage object as context', async () => {
    const storage = createJSONStorage();

    const createdRecord = await storage.create('applications', {
      company: 'Test Company',
      position: 'Developer',
    });

    const { getById } = storage;

    const record = await getById('applications', createdRecord.id);

    assert.deepStrictEqual(record, createdRecord);
  });

  it('rejects inherited property names as collections', async () => {
    await assert.rejects(jsonStorage.list('constructor'), /Unsupported JSON collection/);

    await assert.rejects(jsonStorage.list('toString'), /Unsupported JSON collection/);
  });

  it('rejects JSON files with a null root value', async () => {
    await fs.writeFile(path.join(dataDir, 'jobs.json'), 'null', 'utf8');

    await assert.rejects(jsonStorage.list('applications'), {
      name: 'TypeError',
      message: 'jobs.json does not contain "applications"',
    });
  });
});
