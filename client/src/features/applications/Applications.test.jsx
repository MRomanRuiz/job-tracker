import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Applications from './Applications';
import { LABELS } from '../../shared/lib/labels';

const makeApplication = (id, overrides = {}) => ({
  id,
  company: `Acme ${id}`,
  position: 'Desarrollador',
  country: 'España',
  city: 'Madrid',
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
    remove: vi.fn().mockResolvedValue(true),
  };
  const onCloseForm = vi.fn();

  render(
    <Applications collection={collection} showForm={false} onCloseForm={onCloseForm} {...props} />,
  );

  return { collection, onCloseForm };
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
        makeApplication(3, { type: 'research', position: 'Biología' }),
      ],
    });

    fireEvent.change(screen.getByPlaceholderText(LABELS.applications.searchPlaceholder), {
      target: { value: '  GLOBEX ' },
    });
    expect(companies()).toEqual(['Globex']);
    expect(
      screen.getByText(
        `${LABELS.applications.showing} 1 ${LABELS.pagination.of} 3 ${LABELS.applications.plural}`,
      ),
    ).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(LABELS.applications.searchPlaceholder), {
      target: { value: 'biología' },
    });
    expect(companies()).toEqual(['Acme 3']);

    fireEvent.change(screen.getByDisplayValue(LABELS.applications.allTypes), {
      target: { value: 'industry' },
    });
    expect(
      screen.getByText(LABELS.emptyState.noRecords.replace('{label}', LABELS.applications.plural)),
    ).toBeTruthy();
  });

  it('filters by stat card, counting suspended as rejected', () => {
    renderApplications({
      items: [
        makeApplication(1, { status: 'rejected' }),
        makeApplication(2, { status: 'suspended' }),
        makeApplication(3, { status: 'interview' }),
      ],
    });

    const rejected = screen.getByRole('button', {
      name: new RegExp(`^${LABELS.applications.stats.rejected}`),
    });
    expect(within(rejected).getByText('2')).toBeTruthy();

    fireEvent.click(rejected);
    expect(companies()).toEqual(['Acme 2', 'Acme 1']);

    fireEvent.click(rejected);
    expect(companies()).toEqual(['Acme 2', 'Acme 1']);

    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`^${LABELS.applications.stats.total}`) }),
    );
    expect(companies()).toHaveLength(3);
  });

  it('sorts newest first, paginates and resets the page on search', () => {
    renderApplications({
      items: Array.from({ length: 12 }, (_, index) => makeApplication(index + 1)),
    });

    expect(companies()).toHaveLength(10);
    expect(companies()[0]).toBe('Acme 12');
    expect(
      screen.getByText(`${LABELS.pagination.page} 1 ${LABELS.pagination.of} 2`),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: LABELS.pagination.next }));
    expect(companies()).toEqual(['Acme 2', 'Acme 1']);

    fireEvent.change(screen.getByPlaceholderText(LABELS.applications.searchPlaceholder), {
      target: { value: 'acme 1' },
    });
    expect(companies()).toEqual(['Acme 12', 'Acme 11', 'Acme 10', 'Acme 1']);
    expect(screen.queryByText(/^Página/)).toBeNull();
  });

  it('sorts applications by timestamp and displays only the date in the table', () => {
    renderApplications({
      items: [
        makeApplication(1, {
          company: 'Created later',
          appliedAt: '2026-10-25T15:30:00.000Z',
        }),
        makeApplication(2, {
          company: 'Created earlier',
          appliedAt: '2026-10-25T15:29:00.000Z',
        }),
      ],
    });

    expect(companies()).toEqual(['Created later', 'Created earlier']);
    expect(screen.getAllByText('2026-10-25')).toHaveLength(2);
  });

  it('uses the singular label for a single application', () => {
    renderApplications({ items: [makeApplication(1)] });

    expect(
      screen.getByText(
        `${LABELS.applications.showing} 1 ${LABELS.pagination.of} 1 ${LABELS.applications.singular}`,
      ),
    ).toBeTruthy();
  });

  it('creates an application with current fields and closes only on success', async () => {
    const { collection, onCloseForm } = renderApplications({
      showForm: true,
    });

    fireEvent.change(screen.getByPlaceholderText(`${LABELS.fields.position} *`), {
      target: { value: 'Dev' },
    });
    fireEvent.change(screen.getByPlaceholderText(`${LABELS.fields.company} *`), {
      target: { value: 'Acme' },
    });
    fireEvent.change(screen.getByPlaceholderText(`${LABELS.fields.type} *`), {
      target: { value: 'research' },
    });
    fireEvent.change(screen.getByPlaceholderText(`${LABELS.fields.country} *`), {
      target: { value: 'España' },
    });

    fireEvent.click(screen.getByRole('button', { name: LABELS.common.showOptionalFields }));
    fireEvent.change(screen.getByPlaceholderText(LABELS.fields.city), {
      target: { value: 'Madrid' },
    });
    fireEvent.change(screen.getByPlaceholderText(LABELS.common.contractType), {
      target: { value: 'indefinite' },
    });

    collection.create.mockResolvedValueOnce(false);

    fireEvent.click(screen.getByRole('button', { name: LABELS.applications.save }));

    await waitFor(() => expect(collection.create).toHaveBeenCalledTimes(1));

    expect(onCloseForm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: LABELS.applications.save }));

    await waitFor(() => expect(onCloseForm).toHaveBeenCalledTimes(1));

    expect(collection.create).toHaveBeenLastCalledWith({
      company: 'Acme',
      position: 'Dev',
      type: 'research',
      country: 'España',
      city: 'Madrid',
      durationType: 'indefinite',
      durationMonths: null,
      notes: '',
      appliedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
  });

  it('creates a fixed-term application without a duration', async () => {
    const { collection } = renderApplications({ showForm: true });

    fireEvent.change(screen.getByPlaceholderText(`${LABELS.fields.position} *`), {
      target: { value: 'Dev' },
    });
    fireEvent.change(screen.getByPlaceholderText(`${LABELS.fields.company} *`), {
      target: { value: 'Acme' },
    });
    fireEvent.change(screen.getByPlaceholderText(`${LABELS.fields.type} *`), {
      target: { value: 'research' },
    });
    fireEvent.change(screen.getByPlaceholderText(`${LABELS.fields.country} *`), {
      target: { value: 'España' },
    });

    fireEvent.click(screen.getByRole('button', { name: LABELS.common.showOptionalFields }));
    fireEvent.change(screen.getByPlaceholderText(LABELS.common.contractType), {
      target: { value: 'fixed' },
    });
    fireEvent.click(screen.getByRole('button', { name: LABELS.applications.save }));

    await waitFor(() =>
      expect(collection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          durationType: 'fixed',
          durationMonths: null,
        }),
      ),
    );
  });

  it('clears duration when the contract type becomes indefinite or unknown', () => {
    renderApplications({ showForm: true });

    fireEvent.click(screen.getByRole('button', { name: LABELS.common.showOptionalFields }));

    const contractType = screen.getByPlaceholderText(LABELS.common.contractType);
    const duration = screen.getByPlaceholderText(LABELS.fields.conditionalDuration);

    fireEvent.change(contractType, { target: { value: 'fixed' } });
    fireEvent.change(duration, { target: { value: '12' } });
    fireEvent.change(contractType, { target: { value: 'indefinite' } });

    expect(duration.value).toBe('');
    expect(duration.disabled).toBe(true);

    fireEvent.change(contractType, { target: { value: 'fixed' } });
    fireEvent.change(duration, { target: { value: '6' } });
    fireEvent.change(contractType, { target: { value: '' } });

    expect(contractType.value).toBe('');
    expect(duration.value).toBe('');
    expect(duration.disabled).toBe(false);
  });

  it('shows the contract type placeholder initially and submits unknown as empty', async () => {
    const { collection } = renderApplications({ showForm: true });

    fireEvent.click(screen.getByRole('button', { name: LABELS.common.showOptionalFields }));
    const contractType = screen.getByPlaceholderText(LABELS.common.contractType);

    expect(contractType.selectedOptions[0].textContent).toBe(LABELS.common.contractType);

    fireEvent.change(contractType, { target: { value: 'unknown' } });
    fireEvent.change(screen.getByPlaceholderText(`${LABELS.fields.position} *`), {
      target: { value: 'Dev' },
    });
    fireEvent.change(screen.getByPlaceholderText(`${LABELS.fields.company} *`), {
      target: { value: 'Acme' },
    });
    fireEvent.change(screen.getByPlaceholderText(`${LABELS.fields.type} *`), {
      target: { value: 'research' },
    });
    fireEvent.change(screen.getByPlaceholderText(`${LABELS.fields.country} *`), {
      target: { value: 'España' },
    });
    fireEvent.click(screen.getByRole('button', { name: LABELS.applications.save }));

    await waitFor(() =>
      expect(collection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          durationType: '',
          durationMonths: null,
        }),
      ),
    );
  });

  it('shows the current country and translated application types in the table', () => {
    renderApplications({
      items: [makeApplication(1), makeApplication(2, { type: 'research' })],
    });

    expect(screen.getByText(LABELS.fields.country)).toBeTruthy();
    expect(screen.getAllByText('España')).toHaveLength(2);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getAllByRole('cell')[3].textContent).toBe(
      LABELS.applicationTypes.research,
    );
    expect(within(rows[1]).getAllByRole('cell')[3].textContent).toBe(
      LABELS.applicationTypes.industry,
    );
    expect(within(rows[0]).getAllByRole('cell')[3].title).toBe(LABELS.applicationTypes.research);
  });

  it('uses the raw type for unknown types in the table and stale-items alert', () => {
    const unknownType = makeApplication(3, { type: 'legacy-type' });
    renderApplications({ items: [unknownType], staleItems: [unknownType] });

    fireEvent.click(screen.getByRole('button', { name: LABELS.alerts.review }));
    expect(screen.getAllByText('legacy-type')).toHaveLength(2);
  });

  it('disables duration months when the contract is indefinite', () => {
    renderApplications({ showForm: true });

    fireEvent.click(screen.getByRole('button', { name: LABELS.common.showOptionalFields }));
    fireEvent.change(screen.getByPlaceholderText(LABELS.common.contractType), {
      target: { value: 'indefinite' },
    });

    expect(screen.getByPlaceholderText(LABELS.fields.conditionalDuration).disabled).toBe(true);
  });

  it('keeps duration months enabled for a fixed-term contract', () => {
    renderApplications({ showForm: true });

    fireEvent.click(screen.getByRole('button', { name: LABELS.common.showOptionalFields }));
    fireEvent.change(screen.getByPlaceholderText(LABELS.common.contractType), {
      target: { value: 'fixed' },
    });

    expect(screen.getByPlaceholderText(LABELS.fields.conditionalDuration).disabled).toBe(false);
  });

  it('updates the status from the table', () => {
    const { collection } = renderApplications({ items: [makeApplication(7)] });

    fireEvent.change(screen.getByDisplayValue(LABELS.statuses.application.pending), {
      target: { value: 'interview' },
    });

    expect(collection.update).toHaveBeenCalledWith(7, { status: 'interview' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens full application details from the table and closes with Escape', () => {
    renderApplications({
      items: [
        makeApplication(1, {
          durationType: 'fixed',
          durationMonths: 12,
        }),
      ],
    });

    const statusSelect = screen.getByDisplayValue(LABELS.statuses.application.pending);
    fireEvent.keyDown(statusSelect, { key: 'Enter' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(statusSelect);
    expect(screen.queryByRole('dialog')).toBeNull();

    const row = screen.getAllByRole('row')[1];
    fireEvent.keyDown(row, { key: 'a' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(row, { key: ' ' });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Desarrollador — Acme 1')).toBeTruthy();
    expect(within(dialog).getByText(LABELS.common.contractType).parentElement.textContent).toBe(
      `${LABELS.common.contractType}${LABELS.fields.fixed}`,
    );

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not include the application date when editing other fields', async () => {
    const { collection } = renderApplications({
      items: [makeApplication(1, { appliedAt: '2026-01-15T12:30:00.000Z' })],
    });

    fireEvent.click(screen.getAllByRole('row')[1]);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: LABELS.common.edit }),
    );

    const editDialog = screen.getByRole('dialog');
    expect(within(editDialog).queryByLabelText(LABELS.fields.appliedAt)).toBeNull();
    fireEvent.change(within(editDialog).getByLabelText(LABELS.fields.company), {
      target: { value: 'Globex' },
    });
    fireEvent.click(within(editDialog).getByRole('button', { name: LABELS.common.saveChanges }));

    await waitFor(() =>
      expect(collection.update).toHaveBeenCalledWith(1, { company: 'Globex' }),
    );
  });

  it('restores application details when closing the edit form without changes', () => {
    const { collection } = renderApplications({ items: [makeApplication(1)] });

    fireEvent.click(screen.getAllByRole('row')[1]);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: LABELS.common.edit }),
    );
    fireEvent.click(screen.getByRole('button', { name: LABELS.common.saveChanges }));

    expect(collection.update).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').textContent).toContain('Desarrollador — Acme 1');
  });

  it('closes application details from the backdrop but not from inside the dialog', () => {
    renderApplications({ items: [makeApplication(1)] });
    fireEvent.click(screen.getAllByRole('row')[1]);

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Enter' });
    fireEvent.mouseDown(dialog);
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.mouseDown(dialog.parentElement);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('saves an application note and closes the dialog', async () => {
    const { collection } = renderApplications({
      items: [makeApplication(7, { notes: '' })],
    });

    fireEvent.click(screen.getByRole('button', { name: LABELS.noteForm.add }));
    const dialog = screen.getByRole('dialog');
    const textarea = within(dialog).getByPlaceholderText(LABELS.noteForm.placeholder);

    expect(textarea.value).toBe('');
    fireEvent.change(textarea, { target: { value: 'Enviar seguimiento' } });
    fireEvent.click(within(dialog).getByRole('button', { name: LABELS.common.save }));

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

    fireEvent.click(screen.getByRole('button', { name: LABELS.noteForm.viewAndEdit }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: LABELS.common.save,
      }),
    );

    await waitFor(() => expect(collection.update).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: LABELS.common.cancel,
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('uses the position as the note title when the company is missing', () => {
    renderApplications({
      items: [makeApplication(7, { company: '', position: 'Investigador' })],
    });

    fireEvent.click(screen.getByRole('button', { name: LABELS.noteForm.add }));

    expect(screen.getByRole('dialog').textContent).toContain('Investigador');
  });

  it('only offers allowed next statuses for suspended applications', () => {
    renderApplications({
      items: [makeApplication(1, { status: 'suspended' })],
    });

    const options = within(screen.getByDisplayValue(LABELS.recordEdit.suspended))
      .getAllByRole('option')
      .map(option => option.value);

    expect(options).toEqual(['interview', 'rejected']);
  });

  it('only offers allowed next statuses for pending applications', () => {
    renderApplications({ items: [makeApplication(1)] });

    const options = within(
      screen.getByDisplayValue(LABELS.statuses.application.pending),
    )
      .getAllByRole('option')
      .map(option => option.value);

    expect(options).toEqual(['interview', 'rejected']);
  });

  it('offers the added outcome statuses when an application has an offer', () => {
    renderApplications({
      items: [makeApplication(1, { status: 'offer' })],
    });

    const options = within(screen.getByDisplayValue(LABELS.statuses.application.offer))
      .getAllByRole('option')
      .map(option => option.value);

    expect(options).toEqual(['accepted', 'declined']);
  });

  it('disables the status selector for terminal applications', () => {
    renderApplications({
      items: [makeApplication(1, { status: 'accepted' })],
    });

    expect(
      screen.getByDisplayValue(LABELS.statuses.application.accepted).disabled,
    ).toBe(true);
  });

  it('lists stale applications and suspends them', () => {
    const { collection } = renderApplications({
      staleItems: [makeApplication(4)],
    });

    expect(
      screen.getByText(
        LABELS.alerts.staleMessage
          .replace('{count}', '1')
          .replace('{label}', LABELS.applications.pendingSingular),
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: LABELS.alerts.review }));
    fireEvent.click(screen.getByRole('button', { name: LABELS.alerts.suspend }));

    expect(collection.suspend).toHaveBeenCalledWith(4);
  });

  it('suspends a stale application from its details and closes the dialog', async () => {
    const { collection } = renderApplications({
      staleItems: [makeApplication(4)],
    });

    fireEvent.click(screen.getByRole('button', { name: LABELS.alerts.review }));
    fireEvent.click(screen.getByRole('button', { name: LABELS.alerts.viewDetails }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(LABELS.alerts.staleRecord)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: LABELS.alerts.suspend }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(collection.suspend).toHaveBeenCalledWith(4);
  });

  it('deletes an application only after confirmation', async () => {
    const { collection } = renderApplications({ items: [makeApplication(7)] });

    fireEvent.click(screen.getAllByRole('row')[1]);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: LABELS.common.delete }),
    );

    const confirmation = screen.getByRole('alertdialog');
    expect(within(confirmation).getByText(LABELS.applications.deleteTitle)).toBeTruthy();
    expect(collection.remove).not.toHaveBeenCalled();

    fireEvent.click(
      within(confirmation).getByRole('button', { name: LABELS.common.deletePermanently }),
    );

    await waitFor(() => expect(collection.remove).toHaveBeenCalledWith(7));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('keeps the application and confirmation open when deletion fails', async () => {
    const { collection } = renderApplications({ items: [makeApplication(7)] });
    collection.remove.mockResolvedValue(false);

    fireEvent.click(screen.getAllByRole('row')[1]);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: LABELS.common.delete }),
    );
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: LABELS.common.deletePermanently,
      }),
    );

    await waitFor(() => expect(collection.remove).toHaveBeenCalledWith(7));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('alertdialog')).toBeTruthy();

    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: LABELS.common.cancel }),
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
