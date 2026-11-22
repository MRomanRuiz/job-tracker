import { LABELS } from '../../shared/lib/labels';
import EmptyState from '../../shared/components/EmptyState';
import StatusSelect from '../../shared/components/StatusSelect';
import NoteButton from '../../shared/components/NoteButton';
import { formatDate } from '../../shared/lib/utils';
import sharedConstants from '../../../../shared/constants.json';

function ApplicationsTable({ applications, onStatusChange, onOpenNote, onOpenDetail }) {
  if (applications.length === 0) {
    return <EmptyState label={LABELS.applications.plural} />;
  }

  return (
    <table className="applications-table">
      <thead>
        <tr>
          <th>{LABELS.applications.table.company}</th>
          <th>{LABELS.applications.table.position}</th>
          <th>{LABELS.applications.table.place}</th>
          <th>{LABELS.applications.table.type}</th>
          <th>{LABELS.applications.table.date}</th>
          <th>{LABELS.applications.table.status}</th>
          <th>{LABELS.applications.table.note}</th>
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
            title={LABELS.table.rowTitle}
          >
            <td title={job.company}>{job.company}</td>
            <td title={job.position}>{job.position}</td>
            <td title={job.city?.trim() || job.country}>
              {job.city?.trim() || job.country}
            </td>
            <td title={LABELS.applicationTypes[job.type] || job.type}>
              {LABELS.applicationTypes[job.type] || job.type}
            </td>
            <td className="date-cell" title={formatDate(job.appliedAt)}>
              {formatDate(job.appliedAt)}
            </td>

            <td onClick={event => event.stopPropagation()}>
              <StatusSelect
                value={job.status}
                statuses={sharedConstants.RECORD_STATUSES.application}
                transitions={sharedConstants.RECORD_TRANSITIONS.application}
                labels={LABELS.statuses.application}
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
