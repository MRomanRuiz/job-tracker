import { describe, expect, it } from 'vitest';
import { LABELS } from '../shared/lib/labels';
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

    expect(fields.type.format('industry')).toBe(LABELS.applicationTypes.industry);
    expect(fields.type.format('legacy-type')).toBe('legacy-type');
    expect(fields.durationType.format('fixed')).toBe(LABELS.fields.fixed);
    expect(fields.durationType.format('legacy-duration')).toBe('—');
    expect(fields.durationMonths.format(null)).toBe('—');
    expect(fields.status.format('pending')).toBe(LABELS.statuses.application.pending);
    expect(fields.status.format('legacy-status')).toBe('legacy-status');
  });

  it('formats known and unknown contact statuses', () => {
    const status = CONTACT_FIELDS.find(field => field.name === 'status');

    expect(status.format('in_conversation')).toBe(LABELS.statuses.contact.in_conversation);
    expect(status.format('legacy-status')).toBe('legacy-status');
  });

  it('keeps scheduled contact dates editable and formats only the date', () => {
    const scheduledAt = '2026-03-04T12:30:00.000Z';
    const field = CONTACT_FIELDS.find(item => item.name === 'scheduledAt');

    expect(field.editable).toBe(true);
    expect(field.type).toBe('date');
    expect(field.format(scheduledAt)).toBe('2026-03-04');
  });

  it('keeps scheduled application date-times editable and formats the time', () => {
    const scheduledAt = '2026-03-04T12:30:00.000Z';
    const field = APPLICATION_FIELDS.find(item => item.name === 'scheduledAt');

    expect(field.editable).toBe(true);
    expect(field.type).toBe('datetime-local');
    expect(field.format(scheduledAt)).toBe(
      new Intl.DateTimeFormat(LABELS.locale, {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(scheduledAt)),
    );
    expect(field.format(scheduledAt)).not.toBe(scheduledAt.slice(0, 10));
  });
});
