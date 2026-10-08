function ContactForm({
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
      <h2>Nuevo contacto</h2>

      <form onSubmit={onSubmit}>
        <input
          type="text"
          name="contact"
          placeholder="Contacto / Email"
          value={formData.contact}
          onChange={handleChange}
        />

        <input
          type="text"
          name="center"
          placeholder="Centro / Empresa"
          value={formData.center}
          onChange={handleChange}
        />

        <input
          type="date"
          name="contactedAt"
          value={formData.contactedAt}
          onChange={handleChange}
        />

        <div className="form-actions">
          <button
            type="submit"
            className="primary-button"
          >
            Guardar contacto
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

export default ContactForm;
