import { describe, expect, it } from 'vitest';
import { ALL_STATUSES } from './constants.js';
import { LABELS } from './labels.js';
import {
  countByStatus,
  formatDate,
  matchesStatus,
  matchesText,
  replaceById,
  sortByDateDesc,
} from './utils.js';

describe('matchesStatus', () => {
  it('treats suspended as rejected', () => {
    expect(matchesStatus({ status: 'suspended' }, 'rejected')).toBe(true);
    expect(matchesStatus({ status: 'pending' }, 'rejected')).toBe(false);
    expect(matchesStatus({ status: 'pending' }, ALL_STATUSES)).toBe(true);
  });

  it('treats follow_up as pending', () => {
    expect(matchesStatus({ status: 'follow_up' }, 'pending')).toBe(true);
    expect(matchesStatus({ status: 'in_conversation' }, 'pending')).toBe(false);
  });

  it('counts items by status', () => {
    const items = [
      { status: 'rejected' },
      { status: 'suspended' },
      { status: 'pending' },
      { status: 'follow_up' },
    ];

    expect(countByStatus(items, 'rejected')).toBe(2);
    expect(countByStatus(items, 'pending')).toBe(2);
    expect(countByStatus(items, ALL_STATUSES)).toBe(4);
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

  it('formats valid dates and handles missing or non-string values', () => {
    expect(formatDate('2026-03-04T12:30:00.000Z')).toBe('2026-03-04');

    for (const value of [null, undefined, '', 42]) {
      expect(formatDate(value)).toBe(LABELS.common.unknownDate);
    }
  });

  it('replaces an item by id', () => {
    expect(replaceById([{ id: 1, a: 1 }, { id: 2 }], { id: 1, a: 2 })).toEqual([
      { id: 1, a: 2 },
      { id: 2 },
    ]);
  });
});
