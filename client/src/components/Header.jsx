function Header({
  onNewApplication,
  onContacts,
  onBackToApplications,
  onNewContact,
  view,
}) {
  const viewDescriptions = {
    applications: 'Control de tus candidaturas',
    contacts: 'Control de tus contactos',
  };

  let headerActions;

  if (view === 'applications') {
    headerActions = (
      <>
        <button
          className="secondary-button"
          onClick={onContacts}
        >
          Contactos
        </button>

        <button
          className="primary-button"
          onClick={onNewApplication}
        >
          + Nueva candidatura
        </button>
      </>
    );
  } else {
    headerActions = (
      <>
        <button
          className="secondary-button"
          onClick={onBackToApplications}
        >
          ← Candidaturas
        </button>

        <button
          className="primary-button"
          onClick={onNewContact}
        >
          + Nuevo contacto
        </button>
      </>
    );
  }

  return (
    <header className="header">
      <div>
        <h1>Job Tracker</h1>
        <p>{viewDescriptions[view]}</p>
      </div>

      <div className="header-actions">
        {headerActions}
      </div>
    </header>
  );
}

export default Header;
