import { LABELS } from '../../shared/lib/labels';
import EmptyState from '../../shared/components/EmptyState';
import NoteButton from '../../shared/components/NoteButton';
import StatusSelect from '../../shared/components/StatusSelect';
import { formatDate } from '../../shared/lib/utils';
import sharedConstants from '../../../../shared/constants.json';

function ContactsTable({ contacts, onStatusChange, onOpenNote, onOpenDetail }) {
  if (contacts.length === 0) {
    return <EmptyState label={LABELS.contacts.plural} />;
  }

  const handleRowKeyDown = (event, contact) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenDetail?.(contact);
    }
  };

  return (
    <table>
      <thead>
        <tr>
          <th>{LABELS.contacts.table.name}</th>
          <th>{LABELS.contacts.table.email}</th>
          <th>{LABELS.contacts.table.institution}</th>
          <th>{LABELS.contacts.table.country}</th>
          <th>{LABELS.contacts.table.date}</th>
          <th>{LABELS.contacts.table.status}</th>
          <th>{LABELS.contacts.table.note}</th>
        </tr>
      </thead>

      <tbody>
        {contacts.map(contact => (
          <tr
            key={contact.id}
            className="clickable-record-row"
            onClick={() => onOpenDetail?.(contact)}
            onKeyDown={event => handleRowKeyDown(event, contact)}
            tabIndex={0}
            title={LABELS.table.rowTitle}
          >
            <td title={contact.contact}>{contact.contact}</td>
            <td title={contact.email}>{contact.email}</td>
            <td title={contact.institution}>{contact.institution}</td>
            <td title={contact.country}>{contact.country}</td>

            <td className="date-cell" title={formatDate(contact.contactedAt)}>
              {formatDate(contact.contactedAt)}
            </td>

            <td onClick={event => event.stopPropagation()}>
              <StatusSelect
                value={contact.status}
                statuses={sharedConstants.RECORD_STATUSES.contact}
                labels={LABELS.statuses.contact}
                onChange={status => onStatusChange(contact.id, status)}
              />
            </td>

            <td className="notes-cell" onClick={event => event.stopPropagation()}>
              <NoteButton item={contact} onOpen={onOpenNote} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ContactsTable;
