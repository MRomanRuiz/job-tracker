import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_STATUSES } from './constants.js';
import {
  countByStatus,
  matchesStatus,
  matchesText,
  replaceById,
  sortByDateDesc,
} from './utils.js';

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
