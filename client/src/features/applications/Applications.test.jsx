import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Applications from './Applications';

const makeApplication = (id, overrides = {}) => ({
  id,
  company: `Acme ${id}`,
  position: 'Desarrollador',
  country: 'España',
  city: 'Madrid',
  location: 'Madrid',
  type: 'industry',
  appliedAt: `2026-01-${String(id).padStart(2, '0')}`,
  status: 'pending',
  ...overrides,
});

const renderApplications = ({ items = [], staleItems = [], ...props } = {}) => {
  const collection = {
    items,
    staleItems,
    create: vi.fn().mockResolvedValue(true),
    update: vi.fn().mockResolvedValue(true),
    suspend: vi.fn(),
  };
  const onCloseForm = vi.fn();

  render(
    <Applications
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

const companies = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map(row => within(row).getAllByRole('cell')[0].textContent);

describe('Applications', () => {
  it('filters by trimmed, case-insensitive search and by type', () => {
    renderApplications({
      items: [
        makeApplication(1, { company: 'Globex' }),
        makeApplication(2),
        makeApplication(3, { type: 'research', field: 'Biología' }),
      ],
    });

    fireEvent.change(screen.getByPlaceholderText('Buscar empresa, puesto...'), {
      target: { value: '  GLOBEX ' },
    });
    expect(companies()).toEqual(['Globex']);
    expect(screen.getByText('Mostrando 1 de 3 candidaturas')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Buscar empresa, puesto...'), {
      target: { value: 'biología' },
    });
    expect(companies()).toEqual(['Acme 3']);

    fireEvent.change(screen.getByDisplayValue('Todos los tipos'), {
      target: { value: 'industry' },
    });
    expect(screen.getByText('No hay candidaturas que mostrar')).toBeTruthy();
  });

  it('filters by stat card, counting suspended as rejected', () => {
    renderApplications({
      items: [
        makeApplication(1, { status: 'rejected' }),
        makeApplication(2, { status: 'suspended' }),
        makeApplication(3, { status: 'interview' }),
      ],
    });

    const rejected = screen.getByRole('button', { name: /^Rechazadas/ });
    expect(within(rejected).getByText('2')).toBeTruthy();

    fireEvent.click(rejected);
    expect(companies()).toEqual(['Acme 2', 'Acme 1']);

    fireEvent.click(rejected);
    expect(companies()).toEqual(['Acme 2', 'Acme 1']);

    fireEvent.click(screen.getByRole('button', { name: /^Total/ }));
    expect(companies()).toHaveLength(3);
  });

  it('sorts newest first, paginates and resets the page on search', () => {
    renderApplications({
      items: Array.from({ length: 12 }, (_, index) => makeApplication(index + 1)),
    });

    expect(companies()).toHaveLength(10);
    expect(companies()[0]).toBe('Acme 12');
    expect(screen.getByText('Página 1 de 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));
    expect(companies()).toEqual(['Acme 2', 'Acme 1']);

    fireEvent.change(screen.getByPlaceholderText('Buscar empresa, puesto...'), {
      target: { value: 'acme 1' },
    });
    expect(companies()).toEqual(['Acme 12', 'Acme 11', 'Acme 10', 'Acme 1']);
    expect(screen.queryByText(/^Página/)).toBeNull();
  });

  it('uses the singular label for a single application', () => {
    renderApplications({ items: [makeApplication(1)] });

    expect(screen.getByText('Mostrando 1 de 1 candidatura')).toBeTruthy();
  });


  it('creates an application with current fields and closes only on success', async () => {
    const { collection, onCloseForm } = renderApplications({
      showForm: true,
    });

    fireEvent.change(screen.getByPlaceholderText('Puesto *'), {
      target: { value: 'Dev' },
    });
    fireEvent.change(screen.getByPlaceholderText('Empresa *'), {
      target: { value: 'Acme' },
    });
    fireEvent.change(screen.getByPlaceholderText('Tipo *'), {
      target: { value: 'research' },
    });
    fireEvent.change(screen.getByPlaceholderText('País *'), {
      target: { value: 'España' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Mostrar campos opcionales' }),
    );
    fireEvent.change(screen.getByPlaceholderText('Ciudad'), {
      target: { value: 'Madrid' },
    });
    fireEvent.change(screen.getByPlaceholderText('Tipo de contrato'), {
      target: { value: 'indefinite' },
    });

    collection.create.mockResolvedValueOnce(false);

    fireEvent.click(
      screen.getByRole('button', { name: 'Guardar candidatura' }),
    );

    await waitFor(() =>
      expect(collection.create).toHaveBeenCalledTimes(1),
    );

    expect(onCloseForm).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: 'Guardar candidatura' }),
    );

    await waitFor(() =>
      expect(onCloseForm).toHaveBeenCalledTimes(1),
    );

    expect(collection.create).toHaveBeenLastCalledWith({
      company: 'Acme',
      position: 'Dev',
      type: 'research',
      country: 'España',
      city: 'Madrid',
      durationType: 'indefinite',
      durationMonths: '',
      notes: '',
      appliedAt: getToday(),
    });
  });

  it('shows the current country and translated application types in the table', () => {
    renderApplications({
      items: [makeApplication(1), makeApplication(2, { type: 'research' })],
    });

    expect(screen.getByText('País')).toBeTruthy();
    expect(screen.getAllByText('España')).toHaveLength(2);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getAllByRole('cell')[3].textContent).toBe(
      'Investigación',
    );
    expect(within(rows[1]).getAllByRole('cell')[3].textContent).toBe('Empresa');
  });

  it('disables duration months when the contract is indefinite', () => {
    renderApplications({ showForm: true });

    fireEvent.click(
      screen.getByRole('button', { name: 'Mostrar campos opcionales' }),
    );
    fireEvent.change(screen.getByPlaceholderText('Tipo de contrato'), {
      target: { value: 'indefinite' },
    });

    expect(
      screen.getByPlaceholderText('Duración en meses (si es temporal)')
        .disabled,
    ).toBe(true);
  });

  it('keeps duration months enabled for a fixed-term contract', () => {
    renderApplications({ showForm: true });

    fireEvent.click(
      screen.getByRole('button', { name: 'Mostrar campos opcionales' }),
    );
    fireEvent.change(screen.getByPlaceholderText('Tipo de contrato'), {
      target: { value: 'fixed' },
    });

    expect(
      screen.getByPlaceholderText('Duración en meses (si es temporal)')
        .disabled,
    ).toBe(false);
  });


  it('updates the status from the table', () => {
    const { collection } = renderApplications({ items: [makeApplication(7)] });

    fireEvent.change(screen.getByDisplayValue('En espera'), {
      target: { value: 'interview' },
    });

    expect(collection.update).toHaveBeenCalledWith(7, { status: 'interview' });
  });

  it('saves an application note and closes the dialog', async () => {
    const { collection } = renderApplications({
      items: [makeApplication(7, { notes: '' })],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Añadir nota' }));
    const dialog = screen.getByRole('dialog');
    const textarea = within(dialog).getByPlaceholderText('Escribe una nota...');

    expect(textarea.value).toBe('');
    fireEvent.change(textarea, { target: { value: 'Enviar seguimiento' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(collection.update).toHaveBeenCalledWith(7, {
      notes: 'Enviar seguimiento',
    });
  });

  it('keeps the note dialog open when saving fails and closes on cancel', async () => {
    const { collection } = renderApplications({
      items: [makeApplication(7, { notes: 'Seguimiento' })],
    });
    collection.update.mockResolvedValue(false);

    fireEvent.click(
      screen.getByRole('button', { name: 'Ver y editar nota' }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Guardar',
      }),
    );

    await waitFor(() => expect(collection.update).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancelar',
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('uses the position as the note title when the company is missing', () => {
    renderApplications({
      items: [makeApplication(7, { company: '', position: 'Investigador' })],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Añadir nota' }));

    expect(screen.getByRole('dialog').textContent).toContain('Investigador');
  });

  it('only offers suspended for suspended applications', () => {
    renderApplications({
      items: [makeApplication(1, { status: 'suspended' })],
    });

    const options = within(screen.getByDisplayValue('Suspendido'))
      .getAllByRole('option')
      .map(option => option.value);

    expect(options).toEqual(['interview', 'offer', 'rejected', 'suspended']);
  });

  it('lists stale applications and suspends them', () => {
    const { collection } = renderApplications({
      staleItems: [makeApplication(4)],
    });

    expect(
      screen.getByText('Hay 1 candidatura pendiente de más de 30 días.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Suspender' }));

    expect(collection.suspend).toHaveBeenCalledWith(4);
  });
});
