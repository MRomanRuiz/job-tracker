import { useMemo, useState } from 'react';
import {
  ALL_STATUSES,
  CONTACT_STATUS_LABELS,
  ITEMS_PER_PAGE,
} from '../constants';
import usePagination from '../hooks/usePagination';
import {
  countByStatus,
  matchesStatus,
  matchesText,
  sortByDateDesc,
} from '../utils';
import ContactForm from './ContactForm';
import NoteForm from './NoteForm';
import Pagination from './Pagination';
import StaleItemsAlert from './StaleItemsAlert';
import StatCards from './StatCards';
import StatusSelect from './StatusSelect';

const MANUAL_STATUSES = ['pending', 'replied', 'rejected'];

const EMPTY_FORM = {
  contact: '',
  center: '',
  contactedAt: '',
  status: 'pending',
  notes: '',
};

const STAT_ITEMS = [
  { status: ALL_STATUSES, label: 'Total' },
  { status: 'pending', label: 'En espera' },
  { status: 'replied', label: 'Respondidos' },
  { status: 'rejected', label: 'Rechazados' },
];

const renderStaleContact = contact => (
  <>
    <span className="application-company">{contact.contact}</span>
    <span>{contact.center}</span>
    <span className="application-date">{contact.contactedAt}</span>
    <span>{contact.notes || '—'}</span>
  </>
);

function ContactNote({
  contact,
  onOpen,
}) {
  const hasNote = Boolean(
    contact.notes?.trim(),
  );

  let icon = '○';
  let label = 'Añadir nota';
  let buttonClass = 'note-button';

  if (hasNote) {
    icon = '📝';
    label = 'Ver y editar nota';
    buttonClass = 'note-button has-note';
  }

  return (
    <button
      type="button"
      className={buttonClass}
      title={label}
      aria-label={label}
      onClick={() => onOpen(contact)}
    >
      <span aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}

function ContactTable({
  contacts,
  onStatusChange,
  onOpenNote,
}) {
  if (contacts.length === 0) {
    return (
      <div className="empty-state">
        <h3>No hay contactos que mostrar</h3>

        <p>
          No hay contactos que coincidan con los
          criterios seleccionados.
        </p>
      </div>
    );
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

            <td className="date-cell">
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
              <ContactNote
                contact={contact}
                onOpen={onOpenNote}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Contacts({
  contacts,
  oldContacts,
  showForm,
  onCloseForm,
  onCreateContact,
  onUpdateContact,
  onSuspendContact,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedNoteContact, setSelectedNoteContact] = useState(null);
  const [noteValue, setNoteValue] = useState('');

  const statItems = STAT_ITEMS.map(item => ({
    ...item,
    value: countByStatus(contacts, item.status),
  }));

  const filteredContacts = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return sortByDateDesc(
      contacts.filter(
        contact =>
          matchesText(
            [contact.contact, contact.center, contact.notes],
            searchText,
          ) && matchesStatus(contact, statusFilter),
      ),
      'contactedAt',
    );
  }, [contacts, search, statusFilter]);

  const {
    page,
    totalPages,
    pageItems: paginatedContacts,
    setPage,
  } = usePagination(filteredContacts, ITEMS_PER_PAGE);

  const handleStatClick = status => {
    setStatusFilter(current =>
      current === status ? ALL_STATUSES : status,
    );
    setPage(1);
  };

  const handleSearchChange = event => {
    setSearch(event.target.value);
    setPage(1);
  };

  const handleSubmit = async event => {
    event.preventDefault();

    try {
      await onCreateContact(form);
      setForm(EMPTY_FORM);
    } catch (error) {
      console.error(
        'Error creando el contacto:',
        error,
      );
    }
  };

  const handleCloseForm = () => {
    setForm(EMPTY_FORM);
    onCloseForm();
  };

  const handleStatusChange = async (
    id,
    status,
  ) => {
    try {
      await onUpdateContact(id, {
        status,
      });
    } catch (error) {
      console.error(
        'Error actualizando el estado:',
        error,
      );
    }
  };

  const handleSuspendContact = async id => {
    try {
      await onSuspendContact(id);
    } catch (error) {
      console.error(
        'Error suspendiendo el contacto:',
        error,
      );
    }
  };

  const handleOpenNote = contact => {
    setSelectedNoteContact(contact);
    setNoteValue(contact.notes || '');
  };

  const handleCloseNote = () => {
    setSelectedNoteContact(null);
    setNoteValue('');
  };

  const handleSaveNote = async () => {
    if (!selectedNoteContact) {
      return;
    }

    try {
      await onUpdateContact(
        selectedNoteContact.id,
        {
          notes: noteValue,
        },
      );

      handleCloseNote();
    } catch (error) {
      console.error(
        'Error actualizando las notas:',
        error,
      );
    }
  };

  return (
    <>
      <StaleItemsAlert
        items={oldContacts}
        singularLabel="contacto pendiente"
        pluralLabel="contactos pendientes"
        renderCells={renderStaleContact}
        onSuspend={handleSuspendContact}
      />

      <main>
        <section className="section-header">
          <div>
            <h2>Contactos</h2>
          </div>
        </section>

        <StatCards
          items={statItems}
          activeStatus={statusFilter}
          onSelect={handleStatClick}
        />

        {showForm && (
          <ContactForm
            formData={form}
            setFormData={setForm}
            onSubmit={handleSubmit}
            onCancel={handleCloseForm}
          />
        )}

        <section className="toolbar contacts-toolbar">
          <input
            type="search"
            placeholder="Buscar contacto, centro o notas..."
            value={search}
            onChange={handleSearchChange}
          />
        </section>

        <p>
          Mostrando {filteredContacts.length} de{' '}
          {contacts.length} contactos
        </p>

        <section className="table-container">
          <ContactTable
            contacts={paginatedContacts}
            onStatusChange={handleStatusChange}
            onOpenNote={handleOpenNote}
          />
        </section>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          buttonClassName="secondary-button"
          previousLabel="← Anterior"
          nextLabel="Siguiente →"
        />
      </main>

      <NoteForm
        contact={selectedNoteContact}
        note={noteValue}
        onChange={setNoteValue}
        onSave={handleSaveNote}
        onCancel={handleCloseNote}
      />
    </>
  );
}

export default Contacts;
