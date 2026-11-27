const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  isOlderThanStaleLimit,
  isStaleRecord,
  isValidDate,
  parseApplication,
  parseApplicationChanges,
  parseContact,
  parseContactChanges,
  suspendIfStale,
} = require('../../src/domain/records');
const { HttpError } = require('../../src/domain/httpError');

const validApplication = overrides => ({
  company: 'Acme',
  position: 'Engineer',
  country: 'España',
  type: 'research',
  appliedAt: '2026-10-20T12:30:00.000Z',
  status: 'pending',
  durationType: '',
  durationMonths: null,
  ...overrides,
});

const validContact = overrides => ({
  contact: 'Eva',
  email: 'eva@example.com',
  institution: 'Acme',
  department: '',
  city: '',
  country: 'Spain',
  notes: '',
  contactedAt: '2026-10-20T12:30:00.000Z',
  status: 'pending',
  ...overrides,
});

describe('record validation helpers', () => {
  const ALERTABLE_STATUSES = ['pending', 'interview', 'offer', 'in_conversation'];

  it('accepts valid UTC timestamps and rejects malformed timestamps', () => {
    assert.equal(isValidDate('2024-02-29T00:00:00.000Z'), true);
    assert.equal(isValidDate('2023-02-29T00:00:00.000Z'), false);
    assert.equal(isValidDate('2024-01-01T00:00:00+01:00'), false);
    assert.equal(isValidDate(null), false);
  });

  it('treats old records in alertable statuses as stale', () => {
    const now = new Date('2026-02-01T00:00:00.000Z');
    const oldDate = '2025-12-01T00:00:00.000Z';

    assert.equal(isOlderThanStaleLimit(oldDate, now), true);

    assert.equal(
      isStaleRecord({ status: 'pending', appliedAt: oldDate }, ALERTABLE_STATUSES, now),
      true,
    );

    assert.equal(
      isStaleRecord({ status: 'interview', appliedAt: oldDate }, ALERTABLE_STATUSES, now),
      true,
    );

    assert.equal(
      isStaleRecord({ status: 'accepted', appliedAt: oldDate }, ALERTABLE_STATUSES, now),
      false,
    );
  });

  it('uses the latest history event regardless of field and falls back to the creation date', () => {
    const now = new Date('2026-02-01T00:00:00.000Z');

    assert.equal(
      isStaleRecord(
        {
          status: 'pending',
          appliedAt: '2025-01-01T00:00:00.000Z',
          history: [
            { field: 'notes', changedAt: '2026-01-15T00:00:00.000Z' },
            { field: 'status', changedAt: '2025-12-15T00:00:00.000Z' },
          ],
        },
        ALERTABLE_STATUSES,
        now,
      ),
      false,
    );

    assert.equal(
      isStaleRecord(
        {
          status: 'pending',
          appliedAt: '2025-12-01T00:00:00.000Z',
          history: [{ field: 'notes', changedAt: '2026-01-15T00:00:00.000Z' }],
        },
        ALERTABLE_STATUSES,
        now,
      ),
      false,
    );

    assert.equal(
      isStaleRecord(
        {
          status: 'pending',
          appliedAt: '2025-12-01T00:00:00.000Z',
          history: [],
        },
        ALERTABLE_STATUSES,
        now,
      ),
      true,
    );

    assert.equal(
      isStaleRecord(
        {
          status: 'pending',
          appliedAt: '2025-12-01T00:00:00.000Z',
          history: [{ field: 'notes', changedAt: '2026-01-15' }],
        },
        ALERTABLE_STATUSES,
        now,
      ),
      true,
    );
  });

  it('rejects invalid request body shapes', () => {
    for (const body of [null, [], 'invalid']) {
      assert.throws(() => parseApplication(body), HttpError);
    }

    assert.throws(() => parseContact(null), HttpError);
  });

  it('accepts all valid contact statuses', () => {
    const statuses = ['pending', 'in_conversation', 'follow_up', 'completed', 'rejected'];

    for (const status of statuses) {
      assert.equal(parseContactChanges({ status }, validContact()).status, status);
    }
  });

  it('rejects unknown contact statuses', () => {
    assert.throws(() => parseContactChanges({ status: 'replied' }), HttpError);
  });

  it('rejects contacts with missing required fields', () => {
    assert.throws(
      () => parseContact(validContact({ email: '' })),
      error => error instanceof HttpError && error.details.some(detail => detail.field === 'email'),
    );
  });

  it('rejects contacts with invalid contactedAt dates', () => {
    assert.throws(
      () => parseContact(validContact({ contactedAt: 'invalid-date' })),
      error =>
        error instanceof HttpError && error.details.some(detail => detail.field === 'contactedAt'),
    );
  });

  it('accepts valid contact field updates', () => {
    assert.deepEqual(parseContactChanges({ city: 'Madrid' }, validContact()), { city: 'Madrid' });
  });

  it('rejects contact updates when existing required fields are invalid', () => {
    assert.throws(
      () => parseContactChanges({ city: 'Madrid' }, validContact({ email: '' })),
      error => error instanceof HttpError && error.details.some(detail => detail.field === 'email'),
    );
  });

  it('rejects contact updates when the existing contactedAt date is invalid', () => {
    assert.throws(
      () => parseContactChanges({ city: 'Madrid' }, validContact({ contactedAt: 'invalid-date' })),
      error =>
        error instanceof HttpError && error.details.some(detail => detail.field === 'contactedAt'),
    );
  });

  it('allows notes updates without validating the complete contact', () => {
    assert.deepEqual(
      parseContactChanges(
        { notes: 'New notes' },
        validContact({ email: '', contactedAt: 'invalid-date' }),
      ),
      { notes: 'New notes' },
    );
  });

  it('allows valid status updates without validating the complete contact', () => {
    assert.deepEqual(
      parseContactChanges(
        { status: 'in_conversation' },
        validContact({ email: '', contactedAt: 'invalid-date' }),
      ),
      { status: 'in_conversation' },
    );
  });

  it('reports missing and non-string date and enum fields', () => {
    for (const body of [
      validApplication({ appliedAt: undefined }),
      validApplication({ appliedAt: 123 }),
      validApplication({ status: 123 }),
      validApplication({ durationType: 123 }),
      validApplication({ type: '' }),
    ]) {
      assert.throws(() => parseApplication(body), HttpError);
    }

    assert.throws(
      () =>
        parseContact({
          contact: 'Eva',
          email: 'eva@example.com',
          institution: 'Acme',
          country: 'Spain',
          contactedAt: '2026-10-20T12:30:00.000Z',
          status: 123,
        }),
      HttpError,
    );
  });

  it('rejects a non-string duration type when updating an application', () => {
    assert.throws(
      () => parseApplicationChanges({ durationType: 1 }, validApplication({ status: 'pending' })),
      error => error instanceof HttpError && error.details[0].field === 'durationType',
    );
  });
  it('rejects inherited object property names when updating records', () => {
    const currentContact = {
      contact: 'John Doe',
      email: 'john@example.com',
      institution: 'University',
      department: '',
      city: '',
      country: 'Spain',
      notes: '',
      contactedAt: '2026-01-01T10:00:00.000Z',
      status: 'pending',
    };

    for (const field of ['__proto__', 'valueOf', 'hasOwnProperty']) {
      const body = JSON.parse(`{"${field}":{}}`);

      assert.throws(
        () => parseApplicationChanges(body, validApplication({ status: 'pending' })),
        error => error instanceof HttpError && error.details[0].field === field,
      );

      assert.throws(
        () => parseContactChanges(body, currentContact),
        error => error instanceof HttpError && error.details[0].field === field,
      );
    }
  });

  it('accepts fixed duration with positive months', () => {
    assert.deepEqual(
      parseApplicationChanges(
        { durationMonths: 24 },
        validApplication({ durationType: 'fixed', durationMonths: 12 }),
      ),
      { durationMonths: 24 },
    );
  });

  it('rejects fixed duration without months', () => {
    assert.throws(
      () =>
        parseApplicationChanges(
          { durationMonths: '' },
          validApplication({ durationType: 'fixed', durationMonths: 12 }),
        ),
      HttpError,
    );
  });

  it('rejects fixed duration with null months', () => {
    assert.throws(
      () =>
        parseApplicationChanges(
          { durationMonths: null },
          validApplication({ durationType: 'fixed', durationMonths: 12 }),
        ),
      HttpError,
    );
  });

  it('rejects fixed duration with non-integer months', () => {
    assert.throws(
      () =>
        parseApplicationChanges(
          { durationMonths: 1.5 },
          validApplication({ durationType: 'fixed', durationMonths: 12 }),
        ),
      HttpError,
    );
  });

  it('rejects fixed duration with zero or negative months', () => {
    for (const months of [0, -1]) {
      assert.throws(
        () =>
          parseApplicationChanges(
            { durationMonths: months },
            validApplication({ durationType: 'fixed', durationMonths: 12 }),
          ),
        HttpError,
      );
    }
  });

  it('accepts indefinite duration without months', () => {
    assert.deepEqual(
      parseApplicationChanges(
        { durationType: 'indefinite', durationMonths: null },
        validApplication({ durationType: 'fixed', durationMonths: 12 }),
      ),
      { durationType: 'indefinite', durationMonths: null },
    );
  });

  it('rejects indefinite duration with months', () => {
    assert.throws(
      () =>
        parseApplicationChanges(
          { durationType: 'indefinite' },
          validApplication({ durationType: 'fixed', durationMonths: 12 }),
        ),
      HttpError,
    );
  });

  it('accepts unspecified duration without months', () => {
    assert.deepEqual(
      parseApplicationChanges(
        { durationType: '', durationMonths: '' },
        validApplication({ durationType: 'fixed', durationMonths: 12 }),
      ),
      { durationType: '', durationMonths: null },
    );
  });

  it('rejects unspecified duration with months', () => {
    assert.throws(
      () =>
        parseApplicationChanges(
          { durationType: '', durationMonths: 12 },
          validApplication({ durationType: 'fixed', durationMonths: 12 }),
        ),
      HttpError,
    );
  });

  it('rejects invalid duration types', () => {
    assert.throws(
      () =>
        parseApplicationChanges(
          { durationType: 'temporary' },
          validApplication({ durationType: 'fixed', durationMonths: 12 }),
        ),
      HttpError,
    );
  });

  it('uses the supplied messages when a record cannot be suspended', () => {
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    assert.throws(
      () =>
        suspendIfStale({ status: 'rejected', appliedAt: '2025-01-01' }, ALERTABLE_STATUSES, {
          notAlertable: 'Not alertable',
          tooRecent: 'Too recent',
        }),
      error => error instanceof HttpError && error.message === 'Not alertable',
    );

    assert.throws(
      () =>
        suspendIfStale({ status: 'pending', appliedAt: recentDate }, ALERTABLE_STATUSES, {
          notAlertable: 'Not alertable',
          tooRecent: 'Too recent',
        }),
      error => error instanceof HttpError && error.message === 'Too recent',
    );

    assert.throws(
      () =>
        suspendIfStale(
          {
            status: 'pending',
            appliedAt: '2025-01-01T00:00:00.000Z',
            history: [{ field: 'status', changedAt: recentDate }],
          },
          ALERTABLE_STATUSES,
        ),
      error => error instanceof HttpError && error.details[0].field === 'status',
    );
  });

  it('should reject an empty request body', () => {
    assert.throws(() => parseApplicationChanges({}, {}), {
      message: 'Invalid request body',
      statusCode: 400,
      description: 'The request body must be a non-empty JSON object.',
    });

    assert.throws(() => parseContactChanges({}), {
      message: 'Invalid request body',
      statusCode: 400,
      description: 'The request body must be a non-empty JSON object.',
    });
  });

  it('should reject null in optional application text fields', () => {
    assert.throws(
      () =>
        parseApplication({
          company: 'Company',
          position: 'Developer',
          type: 'industry',
          country: 'Spain',
          appliedAt: '2026-11-27T10:00:00.000Z',
          city: null,
        }),
      error => {
        assert.equal(error.statusCode, 400);
        assert.ok(
          error.details.some(detail => detail.field === 'city' && detail.code === 'INVALID_TYPE'),
        );
        return true;
      },
    );
  });

  it('should reject null in optional contact text fields', () => {
    assert.throws(
      () =>
        parseContact({
          contact: 'Ana',
          email: 'ana@example.com',
          institution: 'Company',
          country: 'Spain',
          contactedAt: '2026-11-27T10:00:00.000Z',
          department: null,
        }),
      error => {
        assert.equal(error.statusCode, 400);
        assert.ok(
          error.details.some(
            detail => detail.field === 'department' && detail.code === 'INVALID_TYPE',
          ),
        );
        return true;
      },
    );
  });
});
