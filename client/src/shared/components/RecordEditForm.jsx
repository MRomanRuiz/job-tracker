import { useState } from 'react';
import { getRecordFields } from '../../lib/recordFields';
import { LABELS } from '../lib/labels';
import sharedConstants from '../../../../shared/constants.json';

const DATE_CONVERSION = 60000;
const DATE_FIELD_TYPE = 'date';
const DATETIME_LOCAL_FIELD_TYPE = 'datetime-local';

const toDateTimeLocalInput = value => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * DATE_CONVERSION);

  return localDate.toISOString().slice(0, 16);
};

const getInputValue = (field, value) => {
  if (field.type === DATE_FIELD_TYPE) {
    return value ? String(value).slice(0, 10) : '';
  }

  if (field.type === DATETIME_LOCAL_FIELD_TYPE) {
    return toDateTimeLocalInput(value);
  }

  return value;
};

const getInitialValues = (item, kind) => {
  if (!item) {
    return {};
  }

  const values = {
    ...item,
    durationMonths: item.durationMonths ?? '',
    durationType: item.durationType ?? '',
    notes: item.notes ?? '',
  };

  for (const field of getRecordFields(kind)) {
    if (field.type === DATE_FIELD_TYPE || field.type === DATETIME_LOCAL_FIELD_TYPE) {
      values[field.name] = getInputValue(field, item[field.name]);
    }
  }

  return values;
};

const getChangedValue = (field, value) => {
  if (field.type === DATE_FIELD_TYPE) {
    return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : '';
  }

  if (field.type === DATETIME_LOCAL_FIELD_TYPE) {
    return value ? new Date(value).toISOString() : null;
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
    const original = getInputValue(field, item[field.name] ?? '');

    if (String(value) !== String(original)) {
      changes[field.name] = getChangedValue(field, value);
    }
  }

  return changes;
};

const getStatusOptions = (field, item, kind) => {
  if (field.name !== 'status' || !Object.hasOwn(sharedConstants.RECORD_TRANSITIONS, kind)) {
    return field.options;
  }

  const transitions = sharedConstants.RECORD_TRANSITIONS[kind];
  const allowedStatuses = transitions[item.status] ?? [];

  return field.options.filter(option => allowedStatuses.includes(option.value));
};

const getStatusLabel = (field, item) =>
  field.options.find(option => option.value === item.status)?.label ?? LABELS.recordEdit.suspended;

function SelectField({ field, options, value, item, hasStatusTransitions, isSaving, onChange }) {
  const isStatusField = field.name === 'status';
  const showCurrentStatus = hasStatusTransitions && isStatusField;

  return (
    <select
      id={`edit-${field.name}`}
      className="record-details-input"
      value={value}
      required={field.required}
      disabled={isSaving || (showCurrentStatus && options.length === 0)}
      onChange={event => onChange(field.name, event.target.value)}
    >
      {showCurrentStatus && (
        <option value={item.status} hidden={options.length > 0} disabled>
          {getStatusLabel(field, item)}
        </option>
      )}

      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function TextareaField({ field, value, isSaving, onChange }) {
  return (
    <textarea
      id={`edit-${field.name}`}
      className="record-details-input"
      rows={4}
      value={value}
      disabled={isSaving}
      onChange={event => onChange(field.name, event.target.value)}
    />
  );
}

function InputField({ field, value, isSaving, form, onChange }) {
  const isDurationMonths = field.name === 'durationMonths';
  const isRequired =
    field.required ||
    (field.name === 'scheduledAt' && form.status === 'follow_up');

  return (
    <input
      id={`edit-${field.name}`}
      className="record-details-input"
      type={field.type || 'text'}
      min={field.min}
      required={isRequired}
      disabled={isSaving || (isDurationMonths && form.durationType !== 'fixed')}
      value={value}
      onChange={event => onChange(field.name, event.target.value)}
    />
  );
}

function RecordField({ field, options, form, item, hasStatusTransitions, isSaving, onChange }) {
  const value = form[field.name] ?? '';
  const commonProps = {
    field,
    value,
    isSaving,
    onChange,
  };

  let input;

  if (field.type === 'select') {
    input = (
      <SelectField
        {...commonProps}
        options={options}
        item={item}
        hasStatusTransitions={hasStatusTransitions}
      />
    );
  } else if (field.type === 'textarea') {
    input = <TextareaField {...commonProps} />;
  } else {
    input = <InputField {...commonProps} form={form} />;
  }

  return (
    <div
      className={`record-details-field${
        field.type === 'textarea' ? ' record-details-field-wide' : ''
      }`}
    >
      <label className="record-details-label" htmlFor={`edit-${field.name}`}>
        {field.label}
      </label>

      {input}
    </div>
  );
}

function RecordEditForm({ item, kind, onSave, onClose }) {
  const [form, setForm] = useState(() => getInitialValues(item, kind));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  if (!item) {
    return null;
  }

  const fields = getRecordFields(kind).filter(field => field.editable !== false);

  const fieldsWithOptions = fields.map(field => ({
    field,
    options: getStatusOptions(field, item, kind),
  }));

  const hasStatusTransitions = Object.hasOwn(sharedConstants.RECORD_TRANSITIONS, kind);

  const title =
    kind === 'application' ? LABELS.recordEdit.applicationTitle : LABELS.recordEdit.contactTitle;

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

      onClose(typeof result === 'object' && result !== null ? result : { ...item, ...changes });
    } catch (err) {
      setError(err?.message || LABELS.recordEdit.genericError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdropMouseDown = event => {
    if (event.target === event.currentTarget && !isSaving) {
      onClose();
    }
  };

  return (
    <div className="record-details-backdrop" onMouseDown={handleBackdropMouseDown}>
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
            {fieldsWithOptions.map(({ field, options }) => (
              <RecordField
                key={field.name}
                field={field}
                options={options}
                form={form}
                item={item}
                hasStatusTransitions={hasStatusTransitions}
                isSaving={isSaving}
                onChange={handleChange}
              />
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
