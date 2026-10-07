function Header({ onNewApplication }) {
  return (
    <header className="header">
      <div>
        <h1>Job Tracker</h1>
        <p>Control de tus candidaturas</p>
      </div>

      <button
        className="primary-button"
        onClick={onNewApplication}
      >
        + Nueva candidatura
      </button>
    </header>
  );
}

export default Header;
