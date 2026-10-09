import StatusSelect from './StatusSelect';

const MANUAL_STATUSES = ['pending', 'interview', 'offer', 'rejected'];

function ApplicationsTable({ applications, statusLabels, onStatusChange }) {
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
              <td className="date-cell">{job.appliedAt}</td>
              <td>
                <StatusSelect
                  value={job.status}
                  statuses={MANUAL_STATUSES}
                  labels={statusLabels}
                  onChange={status => onStatusChange(job.id, status)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default ApplicationsTable;
