const VIEWS = {
  applications: {
    description: 'Control de tus candidaturas',
    switchLabel: 'Contactos',
    switchTo: 'contacts',
    newLabel: '+ Nueva candidatura',
  },
  contacts: {
    description: 'Control de tus contactos',
    switchLabel: '← Candidaturas',
    switchTo: 'applications',
    newLabel: '+ Nuevo contacto',
  },
};

function Header({ view, onSwitchView, onNew }) {
  const { description, switchLabel, switchTo, newLabel } = VIEWS[view];

  return (
    <header className="header">
      <div>
        <h1>Job Tracker</h1>
        <p>{description}</p>
      </div>

      <div className="header-actions">
        <button type="button" className="secondary-button" onClick={() => onSwitchView(switchTo)}>
          {switchLabel}
        </button>

        <button type="button" className="primary-button" onClick={onNew}>
          {newLabel}
        </button>
      </div>
    </header>
  );
}

export default Header;
