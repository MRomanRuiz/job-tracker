import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RecordEditForm from './RecordEditForm';
import { LABELS } from '../lib/labels';
import { APPLICATION_FIELDS } from '../../lib/recordFields';

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
    expect(
      within(dialog).getByRole('heading', { name: LABELS.recordEdit.contactTitle }),
    ).toBeTruthy();
    expect(within(dialog).queryByLabelText(LABELS.fields.contactedAt)).toBeNull();
    expect(
      within(dialog)
        .getByLabelText(LABELS.fields.status)
        .querySelector('option[value="suspended"]')
        .textContent,
    ).toBe(LABELS.recordEdit.suspended);
  });

  it('limits application edit status options to allowed transitions', () => {
    renderEditForm();

    const statusSelect = screen.getByLabelText(LABELS.fields.status);
    const visibleOptions = Array.from(statusSelect.options)
      .filter(option => !option.hidden)
      .map(option => option.value);

    expect(visibleOptions).toEqual(['interview', 'rejected']);
  });

  it('offers the added application outcome statuses from offer', () => {
    renderEditForm({ item: { ...application, status: 'offer' } });

    const statusSelect = screen.getByLabelText(LABELS.fields.status);
    const visibleOptions = Array.from(statusSelect.options)
      .filter(option => !option.hidden)
      .map(option => option.value);

    expect(visibleOptions).toEqual(['accepted', 'declined']);
  });

  it('limits contact edit status options to allowed transitions', () => {
    renderEditForm({ item: contact, kind: 'contact' });

    const statusSelect = screen.getByLabelText(LABELS.fields.status);
    const visibleOptions = Array.from(statusSelect.options)
      .filter(option => !option.hidden)
      .map(option => option.value);

    expect(visibleOptions).toEqual(['in_conversation', 'follow_up', 'rejected']);
  });

  it('initializes and saves an editable contact follow-up date at midnight', async () => {
    const scheduledContact = {
      ...contact,
      status: 'follow_up',
      scheduledAt: '2026-03-04T12:30:00.000Z',
    };
    const { onSave } = renderEditForm({
      item: scheduledContact,
      kind: 'contact',
    });
    const input = screen.getByLabelText(LABELS.fields.scheduledAt);

    expect(input.type).toBe('date');
    expect(input.value).toBe('2026-03-04');
    expect(input.required).toBe(true);

    fireEvent.change(input, { target: { value: '2026-03-05' } });
    fireEvent.click(screen.getByRole('button', { name: LABELS.common.saveChanges }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(2, {
        scheduledAt: '2026-03-05T00:00:00.000Z',
      }),
    );
  });

  it('initializes and saves an editable application interview date and time', async () => {
    const scheduledApplication = {
      ...application,
      status: 'interview',
      scheduledAt: '2026-03-04T12:30:00.000Z',
    };
    const { onSave } = renderEditForm({ item: scheduledApplication });
    const input = screen.getByLabelText(LABELS.applications.interviewDateTime);
    const date = new Date(scheduledApplication.scheduledAt);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

    expect(input.type).toBe('datetime-local');
    expect(input.value).toBe(localDate.toISOString().slice(0, 16));
    expect(input.required).toBe(true);

    fireEvent.change(input, { target: { value: '2026-03-05T14:45' } });
    fireEvent.click(screen.getByRole('button', { name: LABELS.common.saveChanges }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(1, {
        scheduledAt: new Date('2026-03-05T14:45').toISOString(),
      }),
    );
  });

  it('does not resubmit an unchanged scheduled date when editing another contact field', async () => {
    const scheduledContact = {
      ...contact,
      status: 'follow_up',
      scheduledAt: '2026-03-04T12:30:45.000Z',
    };
    const { onSave } = renderEditForm({
      item: scheduledContact,
      kind: 'contact',
    });

    fireEvent.change(screen.getByLabelText(LABELS.fields.notes), {
      target: { value: 'Call tomorrow' },
    });
    fireEvent.click(screen.getByRole('button', { name: LABELS.common.saveChanges }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(2, { notes: 'Call tomorrow' }));
  });

  it('initializes nullable contact fields to empty values', () => {
    renderEditForm({
      item: { id: 3, contactedAt: '', durationMonths: null, durationType: null, notes: null },
      kind: 'contact',
    });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByLabelText(LABELS.fields.contactedAt)).toBeNull();
    expect(within(dialog).getByLabelText(LABELS.fields.notes).value).toBe('');
    expect(within(dialog).getByLabelText(LABELS.fields.city).value).toBe('');
  });

  it('uses empty values for fields missing from the record', () => {
    const { onSave, onClose } = renderEditForm({
      item: { id: 3, company: null },
      kind: 'application',
    });

    expect(screen.getByLabelText(LABELS.fields.company).value).toBe('');
    fireEvent.submit(screen.getByRole('dialog').querySelector('form'));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('preserves the contact date when saving other changed fields', async () => {
    const { onSave, onClose } = renderEditForm({ item: contact, kind: 'contact' });
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(LABELS.fields.name), {
      target: { value: 'Eva' },
    });
    fireEvent.change(within(dialog).getByLabelText(LABELS.fields.notes), {
      target: { value: 'Seguimiento' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: LABELS.common.saveChanges }));

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

  it('converts editable date values to ISO timestamps, including an empty date', async () => {
    const dateField = APPLICATION_FIELDS.find(field => field.name === 'appliedAt');
    const originalEditable = dateField.editable;
    dateField.editable = true;

    try {
      const { onSave } = renderEditForm();
      const dateInput = screen.getByLabelText(LABELS.fields.appliedAt);

      fireEvent.change(dateInput, { target: { value: '2026-02-01' } });
      fireEvent.click(screen.getByRole('button', { name: LABELS.common.saveChanges }));

      await waitFor(() =>
        expect(onSave).toHaveBeenNthCalledWith(1, 1, {
          appliedAt: '2026-02-01T00:00:00.000Z',
        }),
      );

      fireEvent.change(dateInput, { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: LABELS.common.saveChanges }));

      await waitFor(() =>
        expect(onSave).toHaveBeenNthCalledWith(2, 1, {
          appliedAt: '',
        }),
      );
    } finally {
      dateField.editable = originalEditable;
    }
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

    fireEvent.change(within(dialog).getByLabelText(LABELS.fields.company), {
      target: { value: 'Globex' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: LABELS.common.saveChanges }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(savedRecord));
  });

  it('closes without saving when submitted values have not changed', () => {
    const { onSave, onClose } = renderEditForm();

    fireEvent.click(screen.getByRole('button', { name: LABELS.common.saveChanges }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith();
  });

  it('clears duration when contract type changes and submits empty months as null', async () => {
    const { onSave } = renderEditForm();
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(LABELS.common.contractType), {
      target: { value: 'indefinite' },
    });
    expect(within(dialog).getByLabelText(LABELS.fields.durationMonths).disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText(LABELS.common.contractType), {
      target: { value: 'fixed' },
    });
    expect(within(dialog).getByLabelText(LABELS.fields.durationMonths).disabled).toBe(false);
    fireEvent.change(within(dialog).getByLabelText(LABELS.fields.durationMonths), {
      target: { value: '' },
    });
    fireEvent.change(within(dialog).getByLabelText(LABELS.fields.city), {
      target: { value: 'Sevilla' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: LABELS.common.saveChanges }));

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

    fireEvent.change(within(dialog).getByLabelText(LABELS.fields.durationMonths), {
      target: { value: '6' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: LABELS.common.saveChanges }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(1, { durationMonths: 6 }));
  });

  it('shows a save error and clears it after the next change', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    renderEditForm({ onSave });
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(LABELS.fields.company), {
      target: { value: 'Globex' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: LABELS.common.saveChanges }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      LABELS.recordEdit.saveError,
    );
    fireEvent.change(within(dialog).getByLabelText(LABELS.fields.company), {
      target: { value: 'Initech' },
    });
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('shows a thrown save error message', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Error de red'));
    renderEditForm({ onSave });
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(LABELS.fields.company), {
      target: { value: 'Globex' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: LABELS.common.saveChanges }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe('Error de red');
  });

  it('uses the fallback message when a save error has no message', async () => {
    const onSave = vi.fn().mockRejectedValue({});
    renderEditForm({ onSave });
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(LABELS.fields.company), {
      target: { value: 'Globex' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: LABELS.common.saveChanges }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      LABELS.recordEdit.genericError,
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

    fireEvent.change(within(dialog).getByLabelText(LABELS.fields.company), {
      target: { value: 'Globex' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: LABELS.common.saveChanges }));

    expect(within(dialog).getByRole('button', { name: LABELS.common.saving }).disabled).toBe(true);
    expect(within(dialog).getByLabelText(LABELS.fields.company).disabled).toBe(true);
    fireEvent.mouseDown(dialog.parentElement);
    fireEvent.click(within(dialog).getByRole('button', { name: LABELS.common.closeForm }));
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

    fireEvent.click(within(dialog).getByRole('button', { name: LABELS.common.cancel }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
