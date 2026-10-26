import { useState } from 'react';

function RecordForm({
  title,
  requiredFields = [],
  optionalFields = [],
  submitLabel,
  onSubmit,
  onCancel,
}) {
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const allFields = [...requiredFields, ...optionalFields];

  const [values, setValues] = useState(() =>
    Object.fromEntries(allFields.map(field => [field.name, field.initialValue ?? ''])),
  );

  const handleChange = event => {
    const { name, value } = event.target;

    setValues(current => ({
      ...current,
      [name]: value,
      ...(name === 'durationType' && value !== 'fixed' ? { durationMonths: '' } : {}),
    }));
  };

  const handleSubmit = event => {
    event.preventDefault();

    const submittedValues = { ...values };

    for (const field of allFields) {
      switch (field.type) {
        case 'number': {
          const value = submittedValues[field.name];

          submittedValues[field.name] = value === '' ? null : Number(value);
          break;
        }
        case 'select':
          if (submittedValues[field.name] === field.emptyOptionValue) {
            submittedValues[field.name] = '';
          }
          break;
        default:
          break;
      }
    }

    onSubmit(submittedValues);
  };

  const renderField = field => {
    const { name, type = 'text', placeholder, required = false, options = [], min, step } = field;

    const props = {
      name,
      required,
      id: name,
      placeholder: required ? `${placeholder} *` : placeholder,
      value: values[name],
      onChange: handleChange,
    };

    let input;

    if (type === 'textarea') {
      input = <textarea {...props} rows={1} />;
    } else if (type === 'select') {
      input = (
        <select {...props}>
          <option value="" hidden disabled>
            {placeholder}
          </option>
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    } else {
      input = (
        <input
          {...props}
          type={type}
          min={min}
          step={step}
          disabled={field.name === 'durationMonths' && values.durationType === 'indefinite'}
        />
      );
    }

    return (
      <div className="record-form-field" key={name}>
        {input}
      </div>
    );
  };

  return (
    <div className="form-container">
      <h2>{title}</h2>

      <form onSubmit={handleSubmit}>
        <div className="record-form-row">
          {requiredFields.map(renderField)}

          {optionalFields.length > 0 && (
            <button
              type="button"
              className="optional-fields-toggle"
              onClick={() => setShowOptionalFields(current => !current)}
              aria-label={
                showOptionalFields ? 'Ocultar campos opcionales' : 'Mostrar campos opcionales'
              }
              aria-expanded={showOptionalFields}
              title={showOptionalFields ? 'Ocultar campos opcionales' : 'Mostrar campos opcionales'}
            >
              ⋮
            </button>
          )}
        </div>

        {showOptionalFields && (
          <div className="record-form-row optional-fields-row">
            {optionalFields.map(renderField)}
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="primary-button">
            {submitLabel}
          </button>

          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export default RecordForm;
