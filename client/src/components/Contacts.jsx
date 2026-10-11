import { useMemo, useState } from 'react';
import { ALL_STATUSES, ITEMS_PER_PAGE } from '../constants';
import usePagination from '../hooks/usePagination';
import {
  countByStatus,
  matchesStatus,
  matchesText,
  sortByDateDesc,
} from '../utils';
import ContactsTable from './ContactsTable';
import NoteForm from './NoteForm';
import Pagination from './Pagination';
import RecordForm from './RecordForm';
import StaleItemsAlert from './StaleItemsAlert';
import StatCards from './StatCards';
import Toolbar from './Toolbar';

const FORM_FIELDS = [
  { name: 'contact', placeholder: 'Contacto / Email', required: true },
  { name: 'center', placeholder: 'Centro / Empresa', required: true },
  { name: 'contactedAt', type: 'date', required: true },
];

const STAT_ITEMS = [
  { status: ALL_STATUSES, label: 'Total' },
  { status: 'pending', label: 'En espera' },
  { status: 'replied', label: 'Respondidos' },
  { status: 'rejected', label: 'Rechazados' },
];

const renderStaleContact = contact => (
  <>
    <span className="stale-primary">{contact.contact}</span>
    <span>{contact.center}</span>
    <span className="stale-date">{contact.contactedAt}</span>
    <span>{contact.notes || '—'}</span>
  </>
);

function Contacts({ collection, showForm, onCloseForm }) {
  const { items: contacts, staleItems, create, update, suspend } = collection;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [noteContact, setNoteContact] = useState(null);

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

  const statItems = STAT_ITEMS.map(item => ({
    ...item,
    value: countByStatus(contacts, item.status),
  }));

  const handleCreate = async values => {
    if (await create({ ...values, status: 'pending', notes: '' })) {
      onCloseForm();
    }
  };

  const handleStatClick = status => {
    setStatusFilter(current => (current === status ? ALL_STATUSES : status));
    setPage(1);
  };

  const handleSearchChange = value => {
    setSearch(value);
    setPage(1);
  };

  const handleSaveNote = async notes => {
    if (await update(noteContact.id, { notes })) {
      setNoteContact(null);
    }
  };

  return (
    <>
      <StaleItemsAlert
        items={staleItems}
        singularLabel="contacto pendiente"
        pluralLabel="contactos pendientes"
        renderCells={renderStaleContact}
        onSuspend={suspend}
      />

      <main>
        <section className="section-header">
          <h2>Contactos</h2>
        </section>

        <StatCards
          items={statItems}
          activeStatus={statusFilter}
          onSelect={handleStatClick}
        />

        {showForm && (
          <RecordForm
            title="Nuevo contacto"
            fields={FORM_FIELDS}
            submitLabel="Guardar contacto"
            onSubmit={handleCreate}
            onCancel={onCloseForm}
          />
        )}

        <Toolbar
          search={search}
          placeholder="Buscar contacto, centro o notas..."
          onSearchChange={handleSearchChange}
        />

        <p>
          Mostrando {filteredContacts.length} de {contacts.length}{' '}
          {contacts.length === 1 ? 'contacto' : 'contactos'}
        </p>

        <section className="table-container">
          <ContactsTable
            contacts={paginatedContacts}
            onStatusChange={(id, status) => update(id, { status })}
            onOpenNote={setNoteContact}
          />
        </section>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </main>

      {noteContact && (
        <NoteForm
          contact={noteContact}
          onSave={handleSaveNote}
          onCancel={() => setNoteContact(null)}
        />
      )}
    </>
  );
}

export default Contacts;
