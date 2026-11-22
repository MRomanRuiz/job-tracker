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

    assert.equal(isOlderThanStaleLimit('2025-12-01', now), true);
    assert.equal(
      isStaleRecord({ status: 'pending', appliedAt: '2025-12-01' }, ALERTABLE_STATUSES, now),
      true,
    );
    assert.equal(
      isStaleRecord({ status: 'interview', appliedAt: '2025-12-01' }, ALERTABLE_STATUSES, now),
      true,
    );
    assert.equal(
      isStaleRecord({ status: 'accepted', appliedAt: '2025-12-01' }, ALERTABLE_STATUSES, now),
      false,
    );
  });

  it('uses the latest status history date and falls back to the creation date', () => {
    const now = new Date('2026-02-01T00:00:00.000Z');

    assert.equal(
      isStaleRecord(
        {
          status: 'pending',
          appliedAt: '2025-01-01T00:00:00.000Z',
          history: [
            { field: 'status', changedAt: '2025-12-15T00:00:00.000Z' },
            { field: 'status', changedAt: '2026-01-15T00:00:00.000Z' },
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
      assert.equal(parseContactChanges({ status }).status, status);
    }
  });

  it('rejects unknown contact statuses', () => {
    assert.throws(() => parseContactChanges({ status: 'replied' }), HttpError);
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
    for (const field of ['__proto__', 'valueOf', 'hasOwnProperty']) {
      const body = JSON.parse(`{"${field}":{}}`);

      assert.throws(
        () => parseApplicationChanges(body, validApplication({ status: 'pending' })),
        error => error instanceof HttpError && error.details[0].field === field,
      );
      assert.throws(
        () => parseContactChanges(body),
        error => error instanceof HttpError && error.details[0].field === field,
      );
    }
  });

  it('handles empty types and empty duration updates', () => {
    assert.throws(
      () =>
        parseApplicationChanges(
          { company: 'Updated' },
          validApplication({ type: '', durationType: 'fixed', durationMonths: 12 }),
        ),
      HttpError,
    );

    assert.deepEqual(
      parseApplicationChanges(
        { durationMonths: '' },
        validApplication({ durationType: 'fixed', durationMonths: 12 }),
      ),
      { durationMonths: null },
    );
  });

  it('uses the supplied messages when a record cannot be suspended', () => {
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    assert.throws(
      () =>
        suspendIfStale(
          { status: 'rejected', appliedAt: '2025-01-01' },
          ALERTABLE_STATUSES,
          {
            notAlertable: 'Not alertable',
            tooRecent: 'Too recent',
          },
        ),
      error => error instanceof HttpError && error.message === 'Not alertable',
    );

    assert.throws(
      () =>
        suspendIfStale(
          { status: 'pending', appliedAt: recentDate },
          ALERTABLE_STATUSES,
          {
            notAlertable: 'Not alertable',
            tooRecent: 'Too recent',
          },
        ),
      error => error instanceof HttpError && error.message === 'Too recent',
    );
  });
});
