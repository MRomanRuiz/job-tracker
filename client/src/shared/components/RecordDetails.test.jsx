import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RecordDetails from './RecordDetails';
import { LABELS } from '../lib/labels';

describe('RecordDetails', () => {
  it('renders nothing when no record is selected', () => {
    const { container } = render(<RecordDetails item={null} kind="application" />);

    expect(container.firstChild).toBeNull();
  });

  it('uses the default application title and allows an omitted delete handler', () => {
    render(
      <RecordDetails item={{ id: 1 }} kind="application" onClose={vi.fn()} onEdit={vi.fn()} />,
    );

    expect(
      screen.getByRole('heading', { name: LABELS.recordDetails.applicationFallback }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: LABELS.common.delete }));
  });

  it('uses the default contact title when contact and institution are missing', () => {
    render(<RecordDetails item={{ id: 2 }} kind="contact" onClose={vi.fn()} onEdit={vi.fn()} />);

    expect(
      screen.getByRole('heading', { name: LABELS.recordDetails.contactFallback }),
    ).toBeTruthy();
  });

  it.each([
    {
      kind: 'application',
      item: { id: 3, company: 'Acme', position: 'Developer', status: 'interview' },
    },
    {
      kind: 'contact',
      item: { id: 4, contact: 'Ana', status: 'in_conversation' },
    },
  ])('shows and allows suspending a stale $kind', ({ kind, item }) => {
    const onSuspend = vi.fn();

    render(
      <RecordDetails item={item} kind={kind} isStale onClose={vi.fn()} onSuspend={onSuspend} />,
    );

    expect(screen.getByText(LABELS.alerts.staleRecord)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: LABELS.alerts.suspend }));
    expect(onSuspend).toHaveBeenCalledWith(item.id);
  });

  it('allows marking a follow-up contact as recontacted', () => {
    const onRecontact = vi.fn();

    render(
      <RecordDetails
        item={{ id: 5, contact: 'Ana', status: 'follow_up' }}
        kind="contact"
        isScheduled
        onClose={vi.fn()}
        onRecontact={onRecontact}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: LABELS.alerts.recontacted }));
    expect(onRecontact).toHaveBeenCalledWith(5);
  });
});
