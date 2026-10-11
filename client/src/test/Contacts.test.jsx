import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Contacts from '../components/Contacts';

const contacts = [
  {
    id: 1,
    contact: 'Ana',
    center: 'Acme',
    contactedAt: '2026-01-02',
    status: 'pending',
    notes: '',
  },
  {
    id: 2,
    contact: 'Luis',
    center: 'Globex',
    contactedAt: '2026-01-01',
    status: 'replied',
    notes: 'Llamar el lunes',
  },
];

const renderContacts = ({ items = contacts, ...props } = {}) => {
  const collection = {
    items,
    staleItems: [],
    create: vi.fn().mockResolvedValue(true),
    update: vi.fn().mockResolvedValue(true),
    suspend: vi.fn(),
  };
  const onCloseForm = vi.fn();

  render(
    <Contacts
      collection={collection}
      showForm={false}
      onCloseForm={onCloseForm}
      {...props}
    />,
  );

  return { collection, onCloseForm };
};

const names = () =>
  screen
    .queryAllByRole('row')
    .slice(1)
    .map(row => within(row).getAllByRole('cell')[0].textContent);

describe('Contacts', () => {
  it('toggles the status filter when a stat card is clicked twice', () => {
    renderContacts();

    const replied = screen.getByRole('button', { name: /^Respondidos/ });

    fireEvent.click(replied);
    expect(names()).toEqual(['Luis']);

    fireEvent.click(replied);
    expect(names()).toEqual(['Ana', 'Luis']);
  });

  it('searches in the notes too', () => {
    renderContacts();

    fireEvent.change(
      screen.getByPlaceholderText('Buscar contacto, centro o notas...'),
      { target: { value: 'lunes' } },
    );

    expect(names()).toEqual(['Luis']);
    expect(screen.getByText('Mostrando 1 de 2 contactos')).toBeTruthy();
  });

  it('creates pending contacts with an empty note', async () => {
    const { collection, onCloseForm } = renderContacts({ showForm: true });

    fireEvent.change(screen.getByPlaceholderText('Contacto / Email'), {
      target: { value: 'Eva' },
    });
    fireEvent.change(screen.getByPlaceholderText('Centro / Empresa'), {
      target: { value: 'Initech' },
    });
    fireEvent.change(document.querySelector('input[name="contactedAt"]'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contacto' }));

    await waitFor(() => expect(onCloseForm).toHaveBeenCalled());
    expect(collection.create).toHaveBeenCalledWith({
      contact: 'Eva',
      center: 'Initech',
      contactedAt: '2026-02-01',
      status: 'pending',
      notes: '',
    });
  });

  it('edits a note and closes the dialog after saving', async () => {
    const { collection } = renderContacts();

    expect(screen.getByRole('button', { name: 'Añadir nota' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver y editar nota' }));

    const dialog = screen.getByRole('dialog');
    const textarea = within(dialog).getByPlaceholderText('Escribe una nota...');

    expect(textarea.value).toBe('Llamar el lunes');

    fireEvent.change(textarea, { target: { value: 'Llamar el martes' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(collection.update).toHaveBeenCalledWith(2, {
      notes: 'Llamar el martes',
    });
  });

  it('closes the note dialog without saving on cancel', () => {
    const { collection } = renderContacts();

    fireEvent.click(screen.getByRole('button', { name: 'Añadir nota' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(collection.update).not.toHaveBeenCalled();
  });
});
