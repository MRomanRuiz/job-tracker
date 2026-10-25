function StatCards({ items, activeStatus, onSelect }) {
  return (
    <section className="stats">
      {items.map(item => (
        <button
          key={item.status}
          type="button"
          className={activeStatus === item.status ? 'stat-card active' : 'stat-card'}
          onClick={() => onSelect(item.status)}
        >
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </button>
      ))}
    </section>
  );
}

export default StatCards;
