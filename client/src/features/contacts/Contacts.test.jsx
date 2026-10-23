import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Contacts from './Contacts';

const contacts = [
  {
    id: 1,
    contact: 'Ana',
    email: 'ana@acme.com',
    institution: 'Acme',
    country: 'España',
    contactedAt: '2026-01-02',
    status: 'pending',
    notes: '',
  },
  {
    id: 2,
    contact: 'Luis',
    email: 'luis@globex.com',
    institution: 'Globex',
    country: 'España',
    contactedAt: '2026-01-01',
    status: 'replied',
    notes: 'Llamar el lunes',
  },
];

const renderContacts = ({
  items = contacts,
  staleItems = [],
  ...props
} = {}) => {
  const collection = {
    items,
    staleItems,
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

const getToday = () => {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
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

  it('keeps contact table rows accessible and opens details from the keyboard', () => {
    renderContacts();

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);

    fireEvent.keyDown(rows[1], { key: 'Enter' });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Ana — Acme')).toBeTruthy();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(rows[2]);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('searches in the notes too', () => {
    renderContacts();

    fireEvent.change(
      screen.getByPlaceholderText(
        'Buscar contacto, institución, email o notas...',
      ),
      { target: { value: 'lunes' } },
    );

    expect(names()).toEqual(['Luis']);
    expect(screen.getByText('Mostrando 1 de 2 contactos')).toBeTruthy();
  });

  it('creates a contact with the current required and optional fields', async () => {
    const { collection, onCloseForm } = renderContacts({
      showForm: true,
    });

    fireEvent.change(screen.getByPlaceholderText('Nombre *'), {
      target: { value: 'Eva' },
    });
    fireEvent.change(screen.getByPlaceholderText('Email o contacto *'), {
      target: { value: 'eva@initech.com' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('Empresa o universidad *'),
      {
      target: { value: 'Initech' },
      },
    );
    fireEvent.change(screen.getByPlaceholderText('País *'), {
      target: { value: 'España' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Mostrar campos opcionales' }),
    );
    fireEvent.change(
      screen.getByPlaceholderText('Departamento o laboratorio'),
      { target: { value: 'Investigación' } },
    );
    fireEvent.change(screen.getByPlaceholderText('Ciudad'), {
      target: { value: 'Madrid' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Guardar contacto' }),
    );

    await waitFor(() => expect(onCloseForm).toHaveBeenCalled());

    expect(collection.create).toHaveBeenCalledWith({
      contact: 'Eva',
      email: 'eva@initech.com',
      institution: 'Initech',
      country: 'España',
      department: 'Investigación',
      city: 'Madrid',
      contactedAt: getToday(),
      status: 'pending',
      notes: '',
    });
  });

  it('keeps the form open when creating a contact fails', async () => {
    const { collection, onCloseForm } = renderContacts({
      showForm: true,
    });
    collection.create.mockResolvedValue(false);

    fireEvent.change(screen.getByPlaceholderText('Nombre *'), {
      target: { value: 'Eva' },
    });
    fireEvent.change(screen.getByPlaceholderText('Email o contacto *'), {
      target: { value: 'eva@email.com' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('Empresa o universidad *'),
      {
      target: { value: 'Initech' },
      },
    );
    fireEvent.change(screen.getByPlaceholderText('País *'), {
      target: { value: 'España' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Guardar contacto' }),
    );

    await waitFor(() => expect(collection.create).toHaveBeenCalled());
    expect(onCloseForm).not.toHaveBeenCalled();
    expect(screen.getByText('Nuevo contacto')).toBeTruthy();
  });

  it('shows details for stale contacts with no notes and suspends them', async () => {
    const { collection } = renderContacts({
      staleItems: [
        {
          ...contacts[0],
          id: 3,
          contact: 'Marta',
          notes: '',
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Marta — Acme')).toBeTruthy();
    expect(
      within(dialog).getByText('Notas').parentElement.textContent,
    ).toBe('Notas—');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Suspender' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(collection.suspend).toHaveBeenCalledWith(3);
  });

  it('uses the plural label for multiple stale contacts', () => {
    renderContacts({
      staleItems: [
        { ...contacts[0], id: 3 },
        { ...contacts[1], id: 4 },
      ],
    });

    expect(
      screen.getByText('Hay 2 contactos pendientes de más de 30 días.'),
    ).toBeTruthy();
  });

  it('updates a contact status from the table', () => {
    const { collection } = renderContacts();

    const statusSelect = screen.getByDisplayValue('En espera');
    fireEvent.click(statusSelect);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(statusSelect, { key: 'Enter' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.change(statusSelect, {
      target: { value: 'replied' },
    });

    expect(collection.update).toHaveBeenCalledWith(1, {
      status: 'replied',
    });
  });

  it('shows the new contact fields in the table and searches by email', () => {
    renderContacts();

    expect(screen.getByText('Email / Contacto')).toBeTruthy();
    expect(screen.getByText('Centro / Empresa')).toBeTruthy();
    expect(screen.getByText('País')).toBeTruthy();
    expect(screen.getByText('ana@acme.com')).toBeTruthy();
    expect(screen.getAllByText('España')).toHaveLength(2);
    expect(screen.getByText('ana@acme.com').closest('td').title).toBe(
      'ana@acme.com',
    );

    fireEvent.change(
      screen.getByPlaceholderText(
        'Buscar contacto, institución, email o notas...',
      ),
      { target: { value: 'luis@globex.com' } },
    );

    expect(names()).toEqual(['Luis']);
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

  it('keeps the note dialog open when saving fails', async () => {
    const { collection } = renderContacts();
    collection.update.mockResolvedValue(false);

    fireEvent.click(screen.getByRole('button', { name: 'Añadir nota' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(collection.update).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('supports moving between pages of contacts', () => {
    const manyContacts = Array.from({ length: 12 }, (_, index) => ({
      ...contacts[0],
      id: index + 1,
      contact: `Contact ${index + 1}`,
      contactedAt: `2026-01-${String(index + 1).padStart(2, '0')}`,
    }));
    renderContacts({ items: manyContacts });

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));
    expect(screen.getByText('Página 2 de 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '← Anterior' }));
    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
  });
});
