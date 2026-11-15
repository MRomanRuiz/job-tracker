import { describe, expect, it } from 'vitest';
import {
  APPLICATION_FIELDS,
  CONTACT_FIELDS,
  getRecordCreateFields,
  getRecordFields,
} from './recordFields';

describe('recordFields', () => {
  it('returns the correct field list and excludes non-creation fields', () => {
    expect(getRecordFields('application')).toBe(APPLICATION_FIELDS);
    expect(getRecordFields('contact')).toBe(CONTACT_FIELDS);
    expect(getRecordFields('unknown')).toBe(CONTACT_FIELDS);
    expect(getRecordCreateFields('application').map(field => field.name)).not.toContain('status');
    expect(getRecordCreateFields('contact').map(field => field.name)).not.toContain('contactedAt');
  });

  it('formats known and unknown application types, statuses, and contract durations', () => {
    const fields = Object.fromEntries(APPLICATION_FIELDS.map(field => [field.name, field]));

    expect(fields.type.format('industry')).toBe('Empresa');
    expect(fields.type.format('legacy-type')).toBe('legacy-type');
    expect(fields.durationType.format('fixed')).toBe('Temporal');
    expect(fields.durationType.format('legacy-duration')).toBe('—');
    expect(fields.durationMonths.format(null)).toBe('—');
    expect(fields.status.format('pending')).toBe('En espera');
    expect(fields.status.format('legacy-status')).toBe('legacy-status');
  });

  it('formats known and unknown contact statuses', () => {
    const status = CONTACT_FIELDS.find(field => field.name === 'status');

    expect(status.format('replied')).toBe('Respondido');
    expect(status.format('legacy-status')).toBe('legacy-status');
  });
});
