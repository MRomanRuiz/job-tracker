import { CONTACT_STATUS_LABELS } from '../../shared/lib/constants';
import EmptyState from '../../shared/components/EmptyState';
import NoteButton from '../../shared/components/NoteButton';
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
          <th>Nombre</th>
          <th>Email / Contacto</th>
          <th>Centro / Empresa</th>
          <th>País</th>
          <th>Fecha</th>
          <th>Estado</th>
          <th>Nota</th>
        </tr>
      </thead>

      <tbody>
        {contacts.map(contact => (
          <tr key={contact.id}>
            <td title={contact.contact}>{contact.contact}</td>
            <td title={contact.email}>{contact.email}</td>
            <td title={contact.institution}>{contact.institution}</td>
            <td title={contact.country}>{contact.country}</td>
            <td className="date-cell" title={contact.contactedAt}>
              {contact.contactedAt}
            </td>
            <td>
              <StatusSelect
                value={contact.status}
                statuses={MANUAL_STATUSES}
                labels={CONTACT_STATUS_LABELS}
                onChange={status => onStatusChange(contact.id, status)}
              />
            </td>
            <td className="notes-cell">
              <NoteButton item={contact} onOpen={onOpenNote} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ContactsTable;
