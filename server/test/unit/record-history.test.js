const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { createHistoryEvents, prepareRecordUpdate } = require('../../src/domain/recordHistory');

describe('record history', () => {
  it('records only changed tracked fields with their previous values', () => {
    const changedAt = '2026-11-10T00:00:00.000Z';

    assert.deepEqual(
      createHistoryEvents(
        { status: 'pending', notes: null },
        { status: 'interview', notes: '', company: 'Other' },
        changedAt,
      ),
      [{ field: 'status', oldValue: 'pending', newValue: 'interview', changedAt }],
    );
  });

  it('preserves existing history or initializes it when absent', () => {
    const previousEvent = { field: 'status', oldValue: 'pending', newValue: 'interview' };
    const changes = { status: 'follow_up' };
    const now = new Date('2026-11-10T00:00:00.000Z');

    assert.deepEqual(
      prepareRecordUpdate({ status: 'pending', notes: '', history: [previousEvent] }, changes, now)
        .history[0],
      previousEvent,
    );
    assert.equal(
      prepareRecordUpdate({ status: 'pending', notes: null, history: null }, changes, now).history
        .length,
      1,
    );
    assert.equal(
      prepareRecordUpdate({ status: 'pending', notes: null }, changes, now).history.length,
      1,
    );
  });

  it('returns the original record when no values change', () => {
    const current = { status: 'pending', notes: '', history: [] };

    assert.equal(prepareRecordUpdate(current, { status: 'pending' }), current);
  });
});
