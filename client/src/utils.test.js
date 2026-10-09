import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_STATUSES } from './constants.js';
import {
  countByStatus,
  getStalePending,
  isOlderThanPendingLimit,
  matchesStatus,
  matchesText,
  replaceById,
  sortByDateDesc,
} from './utils.js';

describe('isOlderThanPendingLimit', () => {
  const now = new Date('2026-02-01');

  it('detects dates older than 30 days', () => {
    assert.equal(isOlderThanPendingLimit('2025-12-01', now), true);
    assert.equal(isOlderThanPendingLimit('2026-01-15', now), false);
    assert.equal(isOlderThanPendingLimit('', now), false);
  });
});

describe('getStalePending', () => {
  it('returns only old pending items', () => {
    const items = [
      { id: 1, status: 'pending', appliedAt: '2020-01-01' },
      { id: 2, status: 'interview', appliedAt: '2020-01-01' },
      { id: 3, status: 'pending', appliedAt: new Date().toISOString() },
    ];

    assert.deepEqual(
      getStalePending(items, 'appliedAt').map(item => item.id),
      [1],
    );
  });
});

describe('matchesStatus', () => {
  it('treats suspended as rejected', () => {
    assert.equal(matchesStatus({ status: 'suspended' }, 'rejected'), true);
    assert.equal(matchesStatus({ status: 'pending' }, 'rejected'), false);
    assert.equal(matchesStatus({ status: 'pending' }, ALL_STATUSES), true);
  });

  it('counts items by status', () => {
    const items = [
      { status: 'rejected' },
      { status: 'suspended' },
      { status: 'pending' },
    ];

    assert.equal(countByStatus(items, 'rejected'), 2);
    assert.equal(countByStatus(items, ALL_STATUSES), 3);
  });
});

describe('helpers', () => {
  it('matches text case-insensitively and ignores empty values', () => {
    assert.equal(matchesText(['Acme Labs', undefined], 'labs'), true);
    assert.equal(matchesText([null], 'x'), false);
  });

  it('sorts by date descending without mutating the input', () => {
    const items = [{ d: '2026-01-01' }, { d: '2026-03-01' }];

    assert.equal(sortByDateDesc(items, 'd')[0].d, '2026-03-01');
    assert.equal(items[0].d, '2026-01-01');
  });

  it('replaces an item by id', () => {
    assert.deepEqual(
      replaceById([{ id: 1, a: 1 }, { id: 2 }], { id: 1, a: 2 }),
      [{ id: 1, a: 2 }, { id: 2 }],
    );
  });
});
