function Toolbar({ search, placeholder, onSearchChange, children }) {
  return (
    <section className={children ? 'toolbar' : 'toolbar search-only'}>
      <input
        type="search"
        placeholder={placeholder}
        value={search}
        onChange={event => onSearchChange(event.target.value)}
      />

      {children}
    </section>
  );
}

export default Toolbar;
