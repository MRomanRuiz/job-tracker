function ApplicationForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
}) {
  const handleChange = event => {
    const { name, value } = event.target;

    setFormData(currentForm => ({
      ...currentForm,
      [name]: value,
    }));
  };

  return (
    <div className="form-container">
      <h2>Nueva candidatura</h2>

      <form onSubmit={onSubmit}>
        <input
          type="text"
          name="company"
          required
          placeholder="Empresa"
          value={formData.company}
          onChange={handleChange}
        />

        <input
          type="text"
          name="position"
          required
          placeholder="Puesto"
          value={formData.position}
          onChange={handleChange}
        />

        <input
          type="text"
          name="location"
          required
          placeholder="Ubicación"
          value={formData.location}
          onChange={handleChange}
        />

        <input
          type="text"
          name="type"
          required
          placeholder="Tipo"
          value={formData.type}
          onChange={handleChange}
        />

        <input
          type="date"
          name="appliedAt"
          required
          value={formData.appliedAt}
          onChange={handleChange}
        />

        <div className="form-actions">
          <button
            type="submit"
            className="primary-button"
          >
            Guardar candidatura
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export default ApplicationForm;
