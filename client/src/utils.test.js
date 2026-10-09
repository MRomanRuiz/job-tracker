import { describe, expect, it } from 'vitest';
import { ALL_STATUSES } from './constants';
import {
  countByStatus,
  getStalePending,
  isOlderThanPendingLimit,
  matchesStatus,
  matchesText,
  replaceById,
  sortByDateDesc,
} from './utils';

describe('isOlderThanPendingLimit', () => {
  const now = new Date('2026-02-01');

  it('detects dates older than 30 days', () => {
    expect(isOlderThanPendingLimit('2025-12-01', now)).toBe(true);
    expect(isOlderThanPendingLimit('2026-01-15', now)).toBe(false);
    expect(isOlderThanPendingLimit('', now)).toBe(false);
  });
});

describe('getStalePending', () => {
  it('returns only old pending items', () => {
    const items = [
      { id: 1, status: 'pending', appliedAt: '2020-01-01' },
      { id: 2, status: 'interview', appliedAt: '2020-01-01' },
      { id: 3, status: 'pending', appliedAt: new Date().toISOString() },
    ];

    expect(getStalePending(items, 'appliedAt').map(item => item.id)).toEqual([
      1,
    ]);
  });
});

describe('matchesStatus', () => {
  it('treats suspended as rejected', () => {
    expect(matchesStatus({ status: 'suspended' }, 'rejected')).toBe(true);
    expect(matchesStatus({ status: 'pending' }, 'rejected')).toBe(false);
    expect(matchesStatus({ status: 'pending' }, ALL_STATUSES)).toBe(true);
  });

  it('counts items by status', () => {
    const items = [
      { status: 'rejected' },
      { status: 'suspended' },
      { status: 'pending' },
    ];

    expect(countByStatus(items, 'rejected')).toBe(2);
    expect(countByStatus(items, ALL_STATUSES)).toBe(3);
  });
});

describe('helpers', () => {
  it('matches text case-insensitively and ignores empty values', () => {
    expect(matchesText(['Acme Labs', undefined], 'labs')).toBe(true);
    expect(matchesText([null], 'x')).toBe(false);
  });

  it('sorts by date descending without mutating the input', () => {
    const items = [{ d: '2026-01-01' }, { d: '2026-03-01' }];

    expect(sortByDateDesc(items, 'd')[0].d).toBe('2026-03-01');
    expect(items[0].d).toBe('2026-01-01');
  });

  it('replaces an item by id', () => {
    expect(replaceById([{ id: 1, a: 1 }, { id: 2 }], { id: 1, a: 2 })).toEqual(
      [{ id: 1, a: 2 }, { id: 2 }],
    );
  });
});
