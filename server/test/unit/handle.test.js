const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const handle = require('../../src/routes/handle');

describe('route handler', () => {
  it('returns the route-specific fallback description for unexpected errors', async () => {
    const response = {
      statusCode: null,
      body: null,
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    await handle('Could not update contact', async () => {
      throw new Error('Storage unavailable');
    })({}, response);

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, {
      message: 'Internal server error',
      description: 'Could not update contact',
    });
  });

  it('rethrows errors after response headers have been sent', async () => {
    const expectedError = new Error('Response already started');
    const wrapped = handle('Request failed', async () => {
      throw expectedError;
    });

    await assert.rejects(wrapped({}, { headersSent: true }), error => error === expectedError);
  });
});
