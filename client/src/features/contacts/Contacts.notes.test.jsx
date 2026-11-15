import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Contacts from './Contacts';

vi.mock('../../shared/components/RecordDetails', () => ({
  default: ({ item, onEditNotes }) => (
    <button type="button" onClick={() => onEditNotes(item)}>
      Editar nota del detalle
    </button>
  ),
}));

describe('Contacts detail note callback', () => {
  it('opens the note form for the selected contact', () => {
    const contact = {
      id: 1,
      contact: 'Ana',
      email: 'ana@example.com',
      institution: 'Acme',
      country: 'Spain',
      contactedAt: '2026-01-01',
      status: 'pending',
      notes: '',
    };

    render(
      <Contacts
        collection={{
          items: [contact],
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
    fireEvent.click(screen.getByRole('button', { name: 'Editar nota del detalle' }));

    expect(screen.getByRole('dialog').textContent).toContain('Ana');
    expect(screen.getByPlaceholderText('Escribe una nota...')).toBeTruthy();
  });
});
