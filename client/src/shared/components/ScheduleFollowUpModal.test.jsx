import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ScheduleFollowUpModal from './ScheduleFollowUpModal';
import { LABELS } from '../lib/labels';

const contact = { contact: 'Ana' };
const application = { company: 'Acme', position: 'Developer' };

const localToday = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);

  return localDate.toISOString().slice(0, 10);
};

describe('ScheduleFollowUpModal', () => {
  it('renders a date-only input for contacts', () => {
    render(
      <ScheduleFollowUpModal
        item={contact}
        itemType="contact"
        dateOnly
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: LABELS.followUp.title })).toBeTruthy();
    expect(
      screen.getByText(LABELS.followUp.forContact.replace('{contact}', contact.contact)),
    ).toBeTruthy();
    expect(screen.getByLabelText(LABELS.fields.scheduledAt).type).toBe('date');
    expect(screen.getByRole('button', { name: LABELS.common.close })).toBeTruthy();
  });

  it('allows scheduling a contact for today', async () => {
    const onSave = vi.fn().mockResolvedValue(true);

    render(
      <ScheduleFollowUpModal
        item={contact}
        itemType="contact"
        dateOnly
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    const dateInput = screen.getByLabelText(LABELS.fields.scheduledAt);
    const today = localToday();

    expect(dateInput.min).toBe(today);
    fireEvent.change(dateInput, { target: { value: today } });
    fireEvent.click(screen.getByRole('button', { name: LABELS.common.save }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(today));
  });

  it('rejects contact dates before today', () => {
    const onSave = vi.fn();

    render(
      <ScheduleFollowUpModal
        item={contact}
        itemType="contact"
        dateOnly
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    const dateInput = screen.getByLabelText(LABELS.fields.scheduledAt);

    fireEvent.change(dateInput, { target: { value: '2000-01-01' } });
    fireEvent.submit(dateInput.closest('form'));

    expect(screen.getByRole('alert').textContent).toBe(LABELS.followUp.dateCannotBePast);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('renders a date-time input and requires a future time for applications', () => {
    const onSave = vi.fn();

    render(
      <ScheduleFollowUpModal
        item={application}
        itemType="application"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: LABELS.followUp.interviewTitle })).toBeTruthy();
    expect(
      screen.getByText(
        LABELS.followUp.forApplication
          .replace('{position}', application.position)
          .replace('{company}', application.company),
      ),
    ).toBeTruthy();

    const dateInput = screen.getByLabelText(LABELS.applications.interviewDateTime);

    expect(dateInput.type).toBe('datetime-local');
    fireEvent.change(dateInput, { target: { value: '2000-01-01T10:00' } });
    fireEvent.submit(dateInput.closest('form'));

    expect(screen.getByRole('alert').textContent).toBe(LABELS.followUp.dateMustBeFuture);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows the localized save error when saving returns false', async () => {
    const onSave = vi.fn().mockResolvedValue(false);

    render(
      <ScheduleFollowUpModal
        item={contact}
        itemType="contact"
        dateOnly
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(LABELS.fields.scheduledAt), {
      target: { value: '2099-01-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: LABELS.common.save }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(LABELS.followUp.saveError);
    });
  });

  it('accepts a successful save callback with no return value', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ScheduleFollowUpModal
        item={contact}
        itemType="contact"
        dateOnly
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(LABELS.fields.scheduledAt), {
      target: { value: '2099-01-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: LABELS.common.save }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('uses the localized generic error when saving throws without a message', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error());

    render(
      <ScheduleFollowUpModal
        item={contact}
        itemType="contact"
        dateOnly
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(LABELS.fields.scheduledAt), {
      target: { value: '2099-01-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: LABELS.common.save }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(LABELS.followUp.genericError);
    });
  });
});
