function EmptyState({ label }) {
  return (
    <div className="empty-state">
      <h3>No hay {label} que mostrar</h3>
      <p>No hay {label} que coincidan con los criterios seleccionados.</p>
    </div>
  );
}

export default EmptyState;
