function ApplicationsTable({
  applications,
  onStatusChange,
}) {
  return (
    <section className="table-container">
      <table>
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Puesto</th>
            <th>Ubicación</th>
            <th>Tipo</th>
            <th>Fecha</th>
            <th>Estado</th>
          </tr>
        </thead>

        <tbody>
          {applications.map(job => (
            <tr key={job.id}>
              <td>{job.company}</td>
              <td>{job.position}</td>
              <td>{job.location}</td>
              <td>{job.type}</td>

              <td className="date-cell">
                {job.appliedAt}
              </td>

              <td>
                <select
                  className={`status-select ${job.status}`}
                  value={job.status}
                  onChange={event =>
                    onStatusChange(
                      job.id,
                      event.target.value,
                    )
                  }
                >
                  {job.status !== 'suspended' && (
                    <option value="pending">
                      En espera
                    </option>
                  )}

                  <option value="interview">
                    Entrevista
                  </option>

                  <option value="offer">
                    Oferta
                  </option>

                  <option value="rejected">
                    Rechazado
                  </option>

                  {job.status === 'suspended' && (
                    <option value="suspended">
                      Suspendido
                    </option>
                  )}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default ApplicationsTable;
