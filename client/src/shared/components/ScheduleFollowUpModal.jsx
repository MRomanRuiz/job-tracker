import { useState } from 'react';
import { LABELS } from '../lib/labels';

const DATE_CONVERION = 60000;

function ScheduleFollowUpModal({ onSave, onCancel }) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const minDateTime = (() => {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * DATE_CONVERION);

    return localDate.toISOString().slice(0, 16);
  })();

  const handleSubmit = async event => {
    event.preventDefault();

    if (!scheduledAt) {
      return;
    }

    if (new Date(scheduledAt) < new Date()) {
      setError('Date must be in the future.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const result = await onSave(scheduledAt);

      if (!result) {
        setError('Could not save the follow-up date.');
      }
    } catch (err) {
      setError(err?.message || 'Error saving follow-up date.');
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
          <h2 id="follow-up-title">Programar seguimiento</h2>

          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={isSaving}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="record-details-field">
            <label className="record-details-label" htmlFor="follow-up-date">
              Fecha y hora del seguimiento
            </label>

            <input
              id="follow-up-date"
              className="record-details-input"
              type="datetime-local"
              value={scheduledAt}
              min={minDateTime}
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
              {isSaving ? 'Guardando...' : 'Guardar'}
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
