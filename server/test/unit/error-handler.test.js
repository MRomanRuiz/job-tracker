const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const errorHandler = require('../../src/middleware/errorHandler');

const responseMock = () => ({
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
});

describe('error handler', () => {
  it('returns a client error for malformed JSON', () => {
    const response = responseMock();

    errorHandler({ type: 'entity.parse.failed' }, {}, response, () => {});

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
      message: 'Invalid JSON',
      description: 'The request body contains malformed JSON.',
    });
  });

  it('returns a payload-too-large response for oversized requests', () => {
    const response = responseMock();

    errorHandler({ type: 'entity.too.large' }, {}, response, () => {});

    assert.equal(response.statusCode, 413);
    assert.equal(response.body.message, 'Payload too large');
  });

  it('returns known client errors with optional descriptions and details', () => {
    const withDetails = responseMock();

    errorHandler(
      {
        statusCode: 409,
        message: 'Conflict',
        description: 'The record changed.',
        details: [{ field: 'status' }],
      },
      {},
      withDetails,
      () => {},
    );

    assert.equal(withDetails.statusCode, 409);
    assert.deepEqual(withDetails.body, {
      message: 'Conflict',
      description: 'The record changed.',
      details: [{ field: 'status' }],
    });

    const withoutOptionalFields = responseMock();
    errorHandler({ statusCode: 400, message: 'Bad request' }, {}, withoutOptionalFields, () => {});
    assert.deepEqual(withoutOptionalFields.body, { message: 'Bad request' });
  });

  it('uses the generic server error for invalid status codes', () => {
    for (const err of [
      { statusCode: 399, message: 'Redirect' },
      { statusCode: 500, message: 'Server error' },
      { statusCode: '400', message: 'String status' },
    ]) {
      const response = responseMock();

      errorHandler(err, {}, response, () => {});

      assert.equal(response.statusCode, 500);
      assert.equal(response.body.message, 'Internal server error');
    }
  });
});
