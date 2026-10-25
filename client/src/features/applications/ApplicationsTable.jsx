import { APPLICATION_STATUS_LABELS, APPLICATION_TYPE_LABELS } from '../../shared/lib/constants';
import EmptyState from '../../shared/components/EmptyState';
import StatusSelect from '../../shared/components/StatusSelect';
import NoteButton from '../../shared/components/NoteButton';

const MANUAL_STATUSES = ['pending', 'interview', 'offer', 'rejected'];

function ApplicationsTable({ applications, onStatusChange, onOpenNote, onOpenDetail }) {
  if (applications.length === 0) {
    return <EmptyState label="candidaturas" />;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Empresa</th>
          <th>Puesto</th>
          <th>País</th>
          <th>Tipo</th>
          <th>Fecha</th>
          <th>Estado</th>
          <th>Nota</th>
        </tr>
      </thead>

      <tbody>
        {applications.map(job => (
          <tr
            key={job.id}
            className="clickable-record-row"
            onClick={() => onOpenDetail(job)}
            onKeyDown={event => {
              if (event.target !== event.currentTarget) {
                return;
              }

              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenDetail(job);
              }
            }}
            tabIndex={0}
            title="Haz clic para ver todos los datos"
          >
            <td title={job.company}>{job.company}</td>
            <td title={job.position}>{job.position}</td>
            <td title={job.country}>{job.country}</td>
            <td title={APPLICATION_TYPE_LABELS[job.type] || job.type}>
              {APPLICATION_TYPE_LABELS[job.type] || job.type}
            </td>
            <td className="date-cell" title={job.appliedAt}>
              {job.appliedAt}
            </td>

            <td onClick={event => event.stopPropagation()}>
              <StatusSelect
                value={job.status}
                statuses={MANUAL_STATUSES}
                labels={APPLICATION_STATUS_LABELS}
                onChange={status => onStatusChange(job.id, status)}
              />
            </td>

            <td className="notes-cell" onClick={event => event.stopPropagation()}>
              <NoteButton item={job} onOpen={onOpenNote} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ApplicationsTable;
