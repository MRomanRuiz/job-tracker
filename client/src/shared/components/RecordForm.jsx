import { useState } from 'react';

function RecordForm({ title, fields, submitLabel, onSubmit, onCancel }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map(field => [field.name, ''])),
  );

  const handleChange = event => {
    const { name, value } = event.target;

    setValues(current => ({ ...current, [name]: value }));
  };

  const handleSubmit = event => {
    event.preventDefault();
    onSubmit(values);
  };

  return (
    <div className="form-container">
      <h2>{title}</h2>

      <form onSubmit={handleSubmit}>
        {fields.map(({ name, type = 'text', placeholder, required }) => (
          <input
            key={name}
            type={type}
            name={name}
            placeholder={placeholder}
            required={required}
            value={values[name]}
            onChange={handleChange}
          />
        ))}

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
