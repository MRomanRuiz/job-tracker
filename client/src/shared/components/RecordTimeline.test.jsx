import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RecordTimeline from './RecordTimeline';
import { LABELS } from '../lib/labels';

describe('RecordTimeline', () => {
  it('renders nothing when the record has no timeline events', () => {
    const { container } = render(<RecordTimeline record={{}} recordType="contact" />);

    expect(container.firstChild).toBeNull();
  });

  it('shows creation and status events while ignoring non-status history', () => {
    const record = {
      contactedAt: '2026-01-01T10:00:00.000Z',
      history: [
        {
          field: 'notes',
          oldValue: '',
          newValue: 'Enviar el informe',
          changedAt: '2026-01-03T10:00:00.000Z',
        },
        {
          field: 'email',
          oldValue: 'old@example.com',
          newValue: 'new@example.com',
          changedAt: '2026-01-02T10:00:00.000Z',
        },
        {
          field: 'status',
          oldValue: 'pending',
          newValue: 'in_conversation',
          changedAt: '2026-01-02T12:00:00.000Z',
        },
        {
          field: 'notes',
          oldValue: 'Enviar el informe',
          newValue: '',
          changedAt: '2026-01-04T10:00:00.000Z',
        },
      ],
    };

    render(<RecordTimeline record={record} recordType="contact" />);

    const list = screen.getByRole('list');
    const events = within(list).getAllByRole('listitem');
    expect(events).toHaveLength(2);
    expect(events.map(event => event.className)).toEqual([
      'record-timeline-event created',
      'record-timeline-event status',
    ]);

    expect(within(events[0]).getByRole('heading', { name: LABELS.timeline.created })).toBeTruthy();
    expect(
      within(events[1]).getByRole('heading', { name: LABELS.timeline.statusUpdated }),
    ).toBeTruthy();
    expect(events[1].textContent).toContain(LABELS.statuses.contact.pending);
    expect(events[1].textContent).toContain(LABELS.statuses.contact.in_conversation);
    expect(within(list).queryByText('Enviar el informe')).toBeNull();
    expect(within(list).queryByText(LABELS.timeline.notesDeleted)).toBeNull();
    for (const event of events) {
      const marker = event.querySelector('.record-timeline-dot');
      expect(marker.textContent).toBe('');
      expect(marker.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('uses application labels and handles unknown values and invalid dates', () => {
    const record = {
      appliedAt: 'invalid-created-date',
      contactedAt: '2026-01-01T10:00:00.000Z',
      history: [
        {
          field: 'status',
          oldValue: 'legacy-status',
          newValue: null,
          changedAt: 'invalid-event-date',
        },
      ],
    };

    render(<RecordTimeline record={record} recordType="application" />);

    const events = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(events).toHaveLength(2);
    expect(within(events[0]).getByText(LABELS.common.unknownDate)).toBeTruthy();
    expect(events[0].textContent).toContain('legacy-status');
    expect(events[0].textContent).toContain('—');
    expect(within(events[1]).getByRole('heading', { name: LABELS.timeline.created })).toBeTruthy();
    expect(events[1].querySelector('time').getAttribute('dateTime')).toBe('invalid-created-date');
  });

  it('uses contact creation date and marks missing dates as unknown', () => {
    render(
      <RecordTimeline
        record={{
          contactedAt: '2026-02-01T10:00:00.000Z',
          history: [
            {
              field: 'status',
              oldValue: null,
              newValue: 'custom',
              changedAt: null,
            },
          ],
        }}
        recordType="contact"
      />,
    );

    const events = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(events).toHaveLength(2);
    expect(within(events[0]).getByText(LABELS.common.unknownDate)).toBeTruthy();
    expect(events[0].textContent).toContain('custom');
    expect(events[0].textContent).toContain('—');
    expect(events[1].querySelector('time').getAttribute('dateTime')).toBe(
      '2026-02-01T10:00:00.000Z',
    );
  });

  it('skips creation event when there is no creation date and tolerates missing history', () => {
    const { container } = render(
      <RecordTimeline record={{ appliedAt: '', history: undefined }} recordType="application" />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders no detail for an unsupported event type', () => {
    const history = [];
    history.filter = () => [
      {
        field: 'legacy',
        changedAt: '2026-01-02T10:00:00.000Z',
      },
    ];

    render(<RecordTimeline record={{ history }} recordType="contact" />);

    const event = within(screen.getByRole('list')).getByRole('listitem');
    expect(within(event).queryByRole('heading')).toBeNull();
  });
});
