import { CONTACT_STATUS_LABELS } from '../../shared/lib/constants';
import EmptyState from '../../shared/components/EmptyState';
import NoteButton from './NoteButton';
import StatusSelect from '../../shared/components/StatusSelect';

const MANUAL_STATUSES = ['pending', 'replied', 'rejected'];

function ContactsTable({ contacts, onStatusChange, onOpenNote }) {
  if (contacts.length === 0) {
    return <EmptyState label="contactos" />;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Contacto</th>
          <th>Centro / Empresa</th>
          <th>Fecha</th>
          <th>Estado</th>
          <th>Nota</th>
        </tr>
      </thead>

      <tbody>
        {contacts.map(contact => (
          <tr key={contact.id}>
            <td>{contact.contact}</td>
            <td>{contact.center}</td>
            <td className="date-cell">{contact.contactedAt}</td>
            <td>
              <StatusSelect
                value={contact.status}
                statuses={MANUAL_STATUSES}
                labels={CONTACT_STATUS_LABELS}
                onChange={status => onStatusChange(contact.id, status)}
              />
            </td>
            <td className="notes-cell">
              <NoteButton contact={contact} onOpen={onOpenNote} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ContactsTable;
