import { useState } from 'react';
import { getRecordFields } from '../../lib/recordFields';
import { LABELS } from '../lib/labels';

const getInitialValues = item =>
  item
    ? {
        ...item,
        contactedAt: item.contactedAt ? String(item.contactedAt).slice(0, 10) : '',
        durationMonths: item.durationMonths ?? '',
        durationType: item.durationType ?? '',
        notes: item.notes ?? '',
      }
    : {};

const getChangedValue = (field, value) => {
  if (field.type === 'date') {
    return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : '';
  }

  if (field.type === 'number') {
    return value === '' ? null : Number(value);
  }

  return value;
};

const getChanges = (fields, form, item) => {
  const changes = {};

  for (const field of fields) {
    const value = form[field.name] ?? '';
    const original = item[field.name] ?? '';

    if (String(value) !== String(original)) {
      changes[field.name] = getChangedValue(field, value);
    }
  }

  return changes;
};

function RecordEditForm({ item, kind, onSave, onClose }) {
  const [form, setForm] = useState(() => getInitialValues(item));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  if (!item) {
    return null;
  }

  const fields = getRecordFields(kind).filter(field => field.editable !== false);

  const title =
    kind === 'application'
      ? LABELS.recordEdit.applicationTitle
      : LABELS.recordEdit.contactTitle;

  const handleChange = (name, value) => {
    setForm(current => {
      const next = { ...current, [name]: value };

      if (name === 'durationType' && value !== 'fixed') {
        next.durationMonths = '';
      }

      return next;
    });

    setError('');
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');

    const changes = getChanges(fields, form, item);

    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);

    try {
      const result = await onSave(item.id, changes);

      if (!result) {
        setError(LABELS.recordEdit.saveError);
        return;
      }

      onClose(
        typeof result === 'object' && result !== null ? result : { ...item, ...changes },
      );
    } catch (err) {
      setError(err?.message || LABELS.recordEdit.genericError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="record-details-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <section
        className="record-details record-edit-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-edit-title"
      >
        <header className="record-details-header">
          <h2 id="record-edit-title">{title}</h2>

          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={isSaving}
            aria-label={LABELS.common.closeForm}
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="record-details-grid">
            {fields.map(field => (
              <div
                key={field.name}
                className={`record-details-field${
                  field.type === 'textarea' ? ' record-details-field-wide' : ''
                }`}
              >
                <label className="record-details-label" htmlFor={`edit-${field.name}`}>
                  {field.label}
                </label>

                {field.type === 'select' ? (
                  <select
                    id={`edit-${field.name}`}
                    className="record-details-input"
                    value={form[field.name] ?? ''}
                    required={field.required}
                    disabled={isSaving}
                    onChange={event => handleChange(field.name, event.target.value)}
                  >
                    {field.options.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}

                    {field.name === 'status' && item.status === 'suspended' && (
                      <option value="suspended">{LABELS.recordEdit.suspended}</option>
                    )}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    id={`edit-${field.name}`}
                    className="record-details-input"
                    rows={4}
                    value={form[field.name] ?? ''}
                    disabled={isSaving}
                    onChange={event => handleChange(field.name, event.target.value)}
                  />
                ) : (
                  <input
                    id={`edit-${field.name}`}
                    className="record-details-input"
                    type={field.type || 'text'}
                    min={field.min}
                    required={field.required}
                    disabled={
                      isSaving || (field.name === 'durationMonths' && form.durationType !== 'fixed')
                    }
                    value={form[field.name] ?? ''}
                    onChange={event => handleChange(field.name, event.target.value)}
                  />
                )}
              </div>
            ))}
          </div>

          <footer className="record-details-actions">
            <button type="submit" className="primary-button" disabled={isSaving}>
              {isSaving ? LABELS.common.saving : LABELS.common.saveChanges}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
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

export default RecordEditForm;
