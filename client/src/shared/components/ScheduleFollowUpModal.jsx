import { useState } from 'react';
import { LABELS } from '../lib/labels';

const DATE_CONVERSION = 60000;

function ScheduleFollowUpModal({ item, itemType, dateOnly = false, onSave, onCancel }) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const { minDate, minDateTime } = (() => {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * DATE_CONVERSION);
    const dateTimeValue = localDate.toISOString().slice(0, 16);

    return {
      minDate: dateTimeValue.slice(0, 10),
      minDateTime: dateTimeValue,
    };
  })();

  const isContact = itemType === 'contact';
  const title = isContact ? LABELS.followUp.title : LABELS.followUp.interviewTitle;
  const description = isContact
    ? LABELS.followUp.forContact.replace('{contact}', item.contact)
    : LABELS.followUp.forApplication
        .replace('{position}', item.position)
        .replace('{company}', item.company);
  const fieldLabel = dateOnly
    ? LABELS.fields.scheduledAt
    : LABELS.applications.interviewDateTime;

  const handleSubmit = async event => {
    event.preventDefault();

    if (!scheduledAt) {
      return;
    }

    const isInPast = dateOnly
      ? scheduledAt < minDate
      : new Date(scheduledAt).getTime() <= Date.now();

    if (isInPast) {
      setError(dateOnly ? LABELS.followUp.dateCannotBePast : LABELS.followUp.dateMustBeFuture);
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const result = await onSave(scheduledAt);

      if (result === false) {
        setError(LABELS.followUp.saveError);
      }
    } catch (err) {
      setError(err?.message || LABELS.followUp.genericError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="record-details-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !isSaving) {
          onCancel();
        }
      }}
    >
      <section
        className="record-details"
        role="dialog"
        aria-modal="true"
        aria-labelledby="follow-up-title"
      >
        <header className="record-details-header">
          <div>
            <h2 id="follow-up-title">{title}</h2>
            <p>{description}</p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={isSaving}
            aria-label={LABELS.common.close}
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="record-details-field">
            <label className="record-details-label" htmlFor="follow-up-date">
              {fieldLabel}
            </label>

            <input
              id="follow-up-date"
              className="record-details-input"
              type={dateOnly ? 'date' : 'datetime-local'}
              value={scheduledAt}
              min={dateOnly ? minDate : minDateTime}
              onChange={event => {
                setScheduledAt(event.target.value);
                setError('');
              }}
              required
              disabled={isSaving}
            />

            {error && (
              <p className="record-details-error" role="alert">
                {error}
              </p>
            )}
          </div>

          <footer className="record-details-actions">
            <button type="submit" className="primary-button" disabled={isSaving || !scheduledAt}>
              {isSaving ? LABELS.common.saving : LABELS.common.save}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={onCancel}
              disabled={isSaving}
            >
              {LABELS.common.cancel}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default ScheduleFollowUpModal;
