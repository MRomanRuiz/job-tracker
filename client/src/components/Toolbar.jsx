function Toolbar({
  search,
  typeFilter,
  onSearchChange,
  onTypeChange,
}) {
  return (
    <section className="toolbar">
      <input
        type="text"
        placeholder="Buscar empresa, puesto..."
        value={search}
        onChange={event =>
          onSearchChange(event.target.value)
        }
      />

      <select
        value={typeFilter}
        onChange={event =>
          onTypeChange(event.target.value)
        }
      >
        <option value="">Todos los tipos</option>
        <option value="Empresa">Empresa</option>
        <option value="Investigación">
          Investigación
        </option>
      </select>
    </section>
  );
}

export default Toolbar;
