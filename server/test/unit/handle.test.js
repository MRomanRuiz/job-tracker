const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const handle = require('../../src/routes/handle');

describe('route handler', () => {
  it('rethrows errors after response headers have been sent', async () => {
    const expectedError = new Error('Response already started');
    const wrapped = handle('Request failed', async () => {
      throw expectedError;
    });

    await assert.rejects(wrapped({}, { headersSent: true }), error => error === expectedError);
  });
});
