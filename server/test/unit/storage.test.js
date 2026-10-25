const path = require('node:path');

const { after, describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('dotenv').config({
  path: path.join(__dirname, '..', '..', '.env.test'),
  override: false,
});

const { createStorage } = require('../../src/storage');

const STORAGE_TYPE = (
  process.env.TEST_STORAGE_TYPE ||
  process.env.STORAGE_TYPE ||
  'json'
).toLowerCase();

const originalStorageType = process.env.STORAGE_TYPE;

after(() => {
  if (originalStorageType === undefined) {
    delete process.env.STORAGE_TYPE;
  } else {
    process.env.STORAGE_TYPE = originalStorageType;
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
  }

  it('rejects unsupported storage types', () => {
    assert.throws(() => createStorage('unsupported'), /STORAGE_TYPE no válido: unsupported/);
  });
});
