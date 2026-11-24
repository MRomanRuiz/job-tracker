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
  isScheduledRecord,
} = require('../../src/domain/records');
const { HttpError } = require('../../src/domain/httpError');

const validApplication = overrides => ({
  company: 'Acme',
  position: 'Engineer',
  country: 'España',
  type: 'research',
  appliedAt: '2026-10-20T12:30:00.000Z',
  scheduledAt: null,
  status: 'pending',
  durationType: '',
  durationMonths: null,
  ...overrides,
});

const validContact = overrides => ({
  contact: 'Eva',
  email: 'eva@example.com',
  institution: 'Acme',
  country: 'España',
  contactedAt: '2026-10-20T12:30:00.000Z',
  scheduledAt: null,
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

  it('detects records with scheduled dates that have arrived', () => {
    const now = new Date('2026-11-25T10:00:00.000Z');

    assert.equal(isScheduledRecord({ scheduledAt: '2026-11-25T09:00:00.000Z' }, now), true);

    assert.equal(isScheduledRecord({ scheduledAt: '2026-11-25T10:00:00.000Z' }, now), true);

    assert.equal(isScheduledRecord({ scheduledAt: '2026-11-25T11:00:00.000Z' }, now), false);

    assert.equal(isScheduledRecord({ scheduledAt: null }, now), false);
    assert.equal(isScheduledRecord({}, now), false);
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

  it('accepts valid contact status updates', () => {
    for (const status of ['pending', 'in_conversation', 'completed', 'rejected']) {
      assert.equal(parseContactChanges({ status }, validContact()).status, status);
    }
  });

  it('requires scheduledAt when entering or remaining in follow_up', () => {
    assert.throws(
      () => parseContactChanges({ status: 'follow_up' }, validContact()),
      error => error instanceof HttpError && error.details[0].field === 'scheduledAt',
    );

    assert.deepEqual(
      parseContactChanges(
        { status: 'follow_up', scheduledAt: '2026-11-25T10:00:00.000Z' },
        validContact(),
      ),
      {
        status: 'follow_up',
        scheduledAt: '2026-11-25T10:00:00.000Z',
      },
    );

    assert.throws(
      () =>
        parseContactChanges(
          { scheduledAt: '' },
          validContact({
            status: 'follow_up',
            scheduledAt: '2026-11-25T10:00:00.000Z',
          }),
        ),
      error => error instanceof HttpError && error.details[0].field === 'scheduledAt',
    );
  });

  it('clears scheduledAt when returning from follow_up to pending', () => {
    assert.deepEqual(
      parseContactChanges(
        { status: 'pending' },
        validContact({
          status: 'follow_up',
          scheduledAt: '2026-11-25T10:00:00.000Z',
        }),
      ),
      {
        status: 'pending',
        scheduledAt: null,
      },
    );
  });

  it('rejects unknown contact statuses', () => {
    assert.throws(() => parseContactChanges({ status: 'replied' }, validContact()), HttpError);
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
        () => parseContactChanges(body, validContact({ status: 'pending' })),
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

  it('parseApplication accepts scheduledAt', () => {
    const scheduledAt = '2026-11-25T10:00:00.000Z';

    const result = parseApplication(validApplication({ scheduledAt }));

    assert.equal(result.scheduledAt, scheduledAt);
  });

  it('parseApplication defaults scheduledAt to null', () => {
    const result = parseApplication(validApplication());

    assert.equal(result.scheduledAt, null);
  });

  it('validates and updates scheduledAt for applications and contacts', () => {
    assert.throws(
      () => parseApplication(validApplication({ scheduledAt: '2026-11-25' })),
      error => error instanceof HttpError && error.details[0].field === 'scheduledAt',
    );
    assert.throws(
      () => parseApplication(validApplication({ scheduledAt: 123 })),
      error => error instanceof HttpError && error.details[0].field === 'scheduledAt',
    );

    assert.deepEqual(
      parseApplicationChanges(
        { scheduledAt: '2026-11-25T10:00:00.000Z' },
        validApplication({ status: 'pending' }),
      ),
      { scheduledAt: '2026-11-25T10:00:00.000Z' },
    );
    assert.deepEqual(
      parseApplicationChanges({ scheduledAt: '' }, validApplication({ status: 'pending' })),
      { scheduledAt: null },
    );

    assert.equal(
      parseContact(validContact({ scheduledAt: '2026-11-25T10:00:00.000Z' })).scheduledAt,
      '2026-11-25T10:00:00.000Z',
    );
    assert.equal(parseContact(validContact()).scheduledAt, null);
    assert.throws(
      () => parseContact(validContact({ scheduledAt: '2026-11-25' })),
      error => error instanceof HttpError && error.details[0].field === 'scheduledAt',
    );
    assert.deepEqual(
      parseContactChanges({ scheduledAt: '2026-11-25T10:00:00.000Z' }, validContact()),
      {
        scheduledAt: '2026-11-25T10:00:00.000Z',
      },
    );
    assert.deepEqual(parseContactChanges({ scheduledAt: '' }, validContact()), {
      scheduledAt: null,
    });
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
});
