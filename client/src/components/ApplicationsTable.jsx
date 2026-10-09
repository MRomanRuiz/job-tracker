import { APPLICATION_STATUS_LABELS } from '../constants';
import EmptyState from './EmptyState';
import StatusSelect from './StatusSelect';

const MANUAL_STATUSES = ['pending', 'interview', 'offer', 'rejected'];

function ApplicationsTable({ applications, onStatusChange }) {
  if (applications.length === 0) {
    return <EmptyState label="candidaturas" />;
  }

  return (
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
                labels={APPLICATION_STATUS_LABELS}
                onChange={status => onStatusChange(job.id, status)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ApplicationsTable;
