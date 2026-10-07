function Stats({
  applications,
  statusFilter,
  onStatusClick,
}) {
  const pendingCount = applications.filter(
    job => job.status === 'pending',
  ).length;

  const interviewCount = applications.filter(
    job => job.status === 'interview',
  ).length;

  const rejectedCount = applications.filter(
    job =>
      job.status === 'rejected' ||
      job.status === 'suspended',
  ).length;

  return (
    <section className="stats">
      <button
        className={[
          'stat-card',
          statusFilter === '' && 'active',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onStatusClick('')}
      >
        <span>Total</span>
        <strong>{applications.length}</strong>
      </button>

      <button
        className={[
          'stat-card',
          statusFilter === 'pending' && 'active',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onStatusClick('pending')}
      >
        <span>En espera</span>
        <strong>{pendingCount}</strong>
      </button>

      <button
        className={[
          'stat-card',
          statusFilter === 'interview' && 'active',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onStatusClick('interview')}
      >
        <span>Entrevistas</span>
        <strong>{interviewCount}</strong>
      </button>

      <button
        className={[
          'stat-card',
          statusFilter === 'rejected' && 'active',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onStatusClick('rejected')}
      >
        <span>Rechazadas</span>
        <strong>{rejectedCount}</strong>
      </button>
    </section>
  );
}

export default Stats;
