import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RecordEditForm from './RecordEditForm';

const application = {
  id: 1,
  company: 'Acme',
  position: 'Desarrollador',
  type: 'industry',
  country: 'España',
  city: 'Madrid',
  appliedAt: '2026-01-15T12:30:00.000Z',
  durationType: 'fixed',
  durationMonths: 12,
  status: 'pending',
  notes: '',
};

const contact = {
  id: 2,
  contact: 'Ana',
  email: 'ana@acme.com',
  institution: 'Acme',
  country: 'España',
  department: '',
  city: '',
  contactedAt: '2026-01-02T12:30:00.000Z',
  status: 'pending',
  notes: '',
};

const renderEditForm = ({
  item = application,
  kind = 'application',
  onSave = vi.fn().mockResolvedValue(true),
  onClose = vi.fn(),
} = {}) => {
  const result = render(
    <RecordEditForm item={item} kind={kind} onSave={onSave} onClose={onClose} />,
  );
  return { ...result, onSave, onClose };
};

describe('RecordEditForm', () => {
  it('renders nothing when there is no item', () => {
    const { container } = renderEditForm({ item: null });

    expect(container.firstChild).toBeNull();
  });

  it('keeps the contact date read-only and shows suspended status', () => {
    renderEditForm({
      item: { ...contact, status: 'suspended' },
      kind: 'contact',
    });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Editar contacto' })).toBeTruthy();
    expect(within(dialog).queryByLabelText('Fecha de contacto')).toBeNull();
    expect(
      within(dialog).getByLabelText('Estado').querySelector('option[value="suspended"]')
        .textContent,
    ).toBe('Suspendido');
  });

  it('initializes nullable contact fields to empty values', () => {
    renderEditForm({
      item: { id: 3, contactedAt: '', durationMonths: null, durationType: null, notes: null },
      kind: 'contact',
    });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByLabelText('Fecha de contacto')).toBeNull();
    expect(within(dialog).getByLabelText('Notas').value).toBe('');
    expect(within(dialog).getByLabelText('Ciudad').value).toBe('');
  });

  it('uses empty values for fields missing from the record', () => {
    const { onSave, onClose } = renderEditForm({
      item: { id: 3, company: null },
      kind: 'application',
    });

    expect(screen.getByLabelText('Empresa').value).toBe('');
    fireEvent.submit(screen.getByRole('dialog').querySelector('form'));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('preserves the contact date when saving other changed fields', async () => {
    const { onSave, onClose } = renderEditForm({ item: contact, kind: 'contact' });
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Nombre'), {
      target: { value: 'Eva' },
    });
    fireEvent.change(within(dialog).getByLabelText('Notas'), {
      target: { value: 'Seguimiento' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(2, {
        contact: 'Eva',
        notes: 'Seguimiento',
      }),
    );
    expect(onClose).toHaveBeenCalledWith({
      ...contact,
      contact: 'Eva',
      notes: 'Seguimiento',
    });
  });

  it('uses the saved record returned by the server when closing', async () => {
    const savedRecord = {
      ...application,
      company: 'Globex',
      updatedAt: '2026-02-01T10:00:00.000Z',
      history: [
        {
          field: 'status',
          oldValue: 'pending',
          newValue: 'interview',
          changedAt: '2026-02-01T10:00:00.000Z',
        },
      ],
    };
    const onSave = vi.fn().mockResolvedValue(savedRecord);
    const { onClose } = renderEditForm({ onSave });
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Empresa'), {
      target: { value: 'Globex' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(savedRecord));
  });

  it('closes without saving when submitted values have not changed', () => {
    const { onSave, onClose } = renderEditForm();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith();
  });

  it('clears duration when contract type changes and submits empty months as null', async () => {
    const { onSave } = renderEditForm();
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Tipo de contrato'), {
      target: { value: 'indefinite' },
    });
    expect(within(dialog).getByLabelText('Duración (meses)').disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText('Tipo de contrato'), {
      target: { value: 'fixed' },
    });
    expect(within(dialog).getByLabelText('Duración (meses)').disabled).toBe(false);
    fireEvent.change(within(dialog).getByLabelText('Duración (meses)'), {
      target: { value: '' },
    });
    fireEvent.change(within(dialog).getByLabelText('Ciudad'), {
      target: { value: 'Sevilla' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(1, {
        durationMonths: null,
        city: 'Sevilla',
      }),
    );
  });

  it('converts a non-empty month count to a number', async () => {
    const { onSave } = renderEditForm();
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Duración (meses)'), {
      target: { value: '6' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(1, { durationMonths: 6 }));
  });

  it('shows a save error and clears it after the next change', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    renderEditForm({ onSave });
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Empresa'), {
      target: { value: 'Globex' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'No se pudieron guardar los cambios. Comprueba los datos e inténtalo de nuevo.',
    );
    fireEvent.change(within(dialog).getByLabelText('Empresa'), {
      target: { value: 'Initech' },
    });
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('shows a thrown save error message', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Error de red'));
    renderEditForm({ onSave });
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Empresa'), {
      target: { value: 'Globex' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe('Error de red');
  });

  it('uses the fallback message when a save error has no message', async () => {
    const onSave = vi.fn().mockRejectedValue({});
    renderEditForm({ onSave });
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Empresa'), {
      target: { value: 'Globex' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Ha ocurrido un error al guardar.',
    );
  });

  it('prevents closing and editing while a save is in progress', async () => {
    let resolveSave;
    const onSave = vi.fn(
      () =>
        new Promise(resolve => {
          resolveSave = resolve;
        }),
    );
    const { onClose } = renderEditForm({ onSave });
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Empresa'), {
      target: { value: 'Globex' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    expect(within(dialog).getByRole('button', { name: 'Guardando…' }).disabled).toBe(true);
    expect(within(dialog).getByLabelText('Empresa').disabled).toBe(true);
    fireEvent.mouseDown(dialog.parentElement);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar formulario' }));
    expect(onClose).not.toHaveBeenCalled();

    resolveSave(true);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('closes from the backdrop and cancel button when not saving', () => {
    const { onClose } = renderEditForm();
    const dialog = screen.getByRole('dialog');

    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(dialog.parentElement);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
