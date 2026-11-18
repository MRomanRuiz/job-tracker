import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Applications from './Applications';
import { LABELS } from '../../shared/lib/labels';

vi.mock('../../shared/components/RecordDetails', () => ({
  default: ({ item, onEditNotes }) => (
    <button type="button" onClick={() => onEditNotes(item)}>
      {LABELS.noteForm.viewAndEdit}
    </button>
  ),
}));

describe('Applications detail note callback', () => {
  it('opens the note form for the selected application', () => {
    const application = {
      id: 1,
      company: 'Acme',
      position: 'Developer',
      type: 'industry',
      country: 'Spain',
      appliedAt: '2026-01-01',
      status: 'pending',
      notes: '',
    };

    render(
      <Applications
        collection={{
          items: [application],
          staleItems: [],
          create: vi.fn(),
          update: vi.fn(),
          suspend: vi.fn(),
          remove: vi.fn(),
        }}
        showForm={false}
        onCloseForm={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole('row')[1]);
    fireEvent.click(screen.getByRole('button', { name: LABELS.noteForm.viewAndEdit }));

    expect(screen.getByRole('dialog').textContent).toContain('Acme');
    expect(screen.getByPlaceholderText(LABELS.noteForm.placeholder)).toBeTruthy();
  });
});
