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
  const { getDB } = require('../../src/db');

  describe('database connection state', () => {
    it('rejects access before connecting', () => {
      assert.throws(() => getDB(), { message: 'MongoDB is not connected' });
    });
  });
}
