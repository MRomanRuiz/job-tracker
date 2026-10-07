function OldApplicationsAlert({
  applications,
  isOpen,
  onToggle,
  onSuspend,
}) {
  if (applications.length === 0) {
    return null;
  }

  return (
    <>
      <div className="old-applications-alert">
        <span className="warning-icon">⚠️</span>

        <strong>
          Hay {applications.length} candidaturas
          pendientes de más de 30 días.
        </strong>

        <button
          type="button"
          onClick={onToggle}
        >
          {isOpen && 'Cancelar'}
          {!isOpen && 'Revisar'}
        </button>
      </div>

      {isOpen && (
        <div className="old-applications-panel">
          {applications.map(application => (
            <div
              className="old-application-row"
              key={application.id}
            >
              <span className="application-company">
                {application.company}
              </span>

              <span>{application.position}</span>
              <span>{application.location}</span>
              <span>{application.type}</span>

              <span className="application-date">
                {application.appliedAt}
              </span>

              <button
                type="button"
                className="suspend-button"
                onClick={() =>
                  onSuspend(application.id)
                }
              >
                Suspender
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default OldApplicationsAlert;
