const path = require('node:path');

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('dotenv').config({
  path: path.join(__dirname, '..', '..', '.env.test'),
  override: false,
});

const STORAGE_TYPE = (
  process.env.TEST_STORAGE_TYPE ||
  process.env.STORAGE_TYPE ||
  'json'
).toLowerCase();

if (STORAGE_TYPE === 'mongodb') {
  const { MongoClient } = require('mongodb');
  const databasePath = require.resolve('../../src/db');
  const mongoStoragePath = require.resolve('../../src/storage/mongodb');

  const originalURI = process.env.MONGODB_URI;
  const originalDatabaseName = process.env.MONGODB_DB;

  describe('database connection state', () => {
    it('requires a URI and database name before loading the database module', () => {
      try {
        delete require.cache[databasePath];
        delete process.env.MONGODB_URI;
        process.env.MONGODB_DB = 'job_tracker_test';
        assert.throws(
          () => require('../../src/db'),
          /MONGODB_URI environment variable is required/,
        );

        delete require.cache[databasePath];
        process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017';
        delete process.env.MONGODB_DB;
        assert.throws(() => require('../../src/db'), /MONGODB_DB environment variable is required/);
      } finally {
        if (originalURI === undefined) {
          delete process.env.MONGODB_URI;
        } else {
          process.env.MONGODB_URI = originalURI;
        }

        if (originalDatabaseName === undefined) {
          delete process.env.MONGODB_DB;
        } else {
          process.env.MONGODB_DB = originalDatabaseName;
        }

        delete require.cache[databasePath];
      }
    });

    it('connects once, exposes the database, and closes idempotently', async () => {
      const originalMethods = {
        connect: MongoClient.prototype.connect,
        db: MongoClient.prototype.db,
        close: MongoClient.prototype.close,
      };
      let connectCount = 0;
      let closeCount = 0;
      const expectedDB = { databaseName: process.env.MONGODB_DB };
      const originalInfo = console.info;
      console.info = () => {};

      MongoClient.prototype.connect = async function connect() {
        connectCount += 1;
        return this;
      };
      MongoClient.prototype.db = () => expectedDB;
      MongoClient.prototype.close = async () => {
        closeCount += 1;
      };

      try {
        delete require.cache[databasePath];
        const database = require('../../src/db');

        assert.throws(() => database.getDB(), { message: 'MongoDB is not connected' });
        assert.equal(await database.connectDB(), expectedDB);
        assert.equal(await database.connectDB(), expectedDB);
        assert.equal(database.getDB(), expectedDB);
        assert.equal(connectCount, 1);

        await database.closeDB();
        await database.closeDB();

        assert.equal(closeCount, 1);
        assert.throws(() => database.getDB(), { message: 'MongoDB is not connected' });
      } finally {
        MongoClient.prototype.connect = originalMethods.connect;
        MongoClient.prototype.db = originalMethods.db;
        MongoClient.prototype.close = originalMethods.close;
        console.info = originalInfo;
        delete require.cache[databasePath];
      }
    });

    it('handles MongoDB update no-ops, invalid revisions, and exhausted retries', async () => {
      delete require.cache[databasePath];
      const database = require('../../src/db');
      const originalGetDB = database.getDB;

      let current;
      let replaceCalls;
      let replacementResult;
      const collection = {
        async findOne() {
          return current;
        },
        async replaceOne(_filter, replacement) {
          replaceCalls += 1;
          replacementResult = replacement;
          return { matchedCount: 0 };
        },
      };
      let insertedRecord;
      const cursor = {
        sort() {
          return this;
        },
        project() {
          return this;
        },
        limit() {
          return this;
        },
        async next() {
          return null;
        },
      };
      const recordCollection = {
        ...collection,
        find: () => cursor,
        async insertOne(record) {
          insertedRecord = record;
        },
      };
      const counterCollection = {
        async updateOne() {},
        async findOneAndUpdate() {
          return { value: { seq: 1 } };
        },
      };
      const fakeDB = {
        collection(name) {
          return name === '_counters' ? counterCollection : recordCollection;
        },
      };

      database.getDB = () => fakeDB;
      delete require.cache[mongoStoragePath];
      const { createMongoStorage } = require('../../src/storage/mongodb');
      const storage = createMongoStorage();

      try {
        current = { _id: 'record', id: 1, notes: '', _storageRevision: 0 };
        replaceCalls = 0;
        const unchanged = await storage.update('applications', 1, { notes: '' });
        assert.equal(unchanged._id, undefined);
        assert.equal(unchanged._storageRevision, undefined);
        assert.equal(replaceCalls, 0);

        current = null;
        assert.equal(await storage.update('applications', 1, { notes: 'Missing' }), null);

        const created = await storage.create('contacts', { contact: 'Eva' });
        assert.equal(created.id, 1);
        assert.equal(created._storageRevision, undefined);
        assert.equal(insertedRecord._storageRevision, 0);

        current = { _id: 'record', id: 1, notes: '', _storageRevision: -1 };
        await assert.rejects(storage.update('applications', 1, { notes: 'Changed' }), /con id 1/);

        current = { _id: 'record', id: 1, notes: '' };
        replaceCalls = 0;
        await assert.rejects(
          storage.update('applications', 1, { notes: 'Changed' }),
          /Could not update applications with id 1 due to concurrent changes/,
        );
        assert.equal(replaceCalls, 5);
        assert.equal(replacementResult._storageRevision, 1);
      } finally {
        database.getDB = originalGetDB;
        delete require.cache[mongoStoragePath];
        delete require.cache[databasePath];
      }
    });
  });
}
