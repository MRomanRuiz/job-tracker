import { useMemo, useState } from 'react';
import { ALL_STATUSES, ITEMS_PER_PAGE } from '../../shared/lib/constants';
import usePagination from '../../shared/hooks/usePagination';
import { countByStatus, matchesStatus, matchesText, sortByDateDesc } from '../../shared/lib/utils';
import ContactsTable from './ContactsTable';
import NoteForm from '../../shared/components/NoteForm';
import Pagination from '../../shared/components/Pagination';
import RecordForm from '../../shared/components/RecordForm';
import StaleItemsAlert from '../../shared/components/StaleItemsAlert';
import StatCards from '../../shared/components/StatCards';
import Toolbar from '../../shared/components/Toolbar';
import RecordDetails from '../../shared/components/RecordDetails';

const REQUIRED_FORM_FIELDS = [
  {
    name: 'contact',
    placeholder: 'Nombre',
    required: true,
  },
  {
    name: 'email',
    placeholder: 'Email o contacto',
    required: true,
  },
  {
    name: 'institution',
    placeholder: 'Empresa o universidad',
    required: true,
  },
  {
    name: 'country',
    placeholder: 'País',
    required: true,
  },
];

const OPTIONAL_FORM_FIELDS = [
  {
    name: 'department',
    placeholder: 'Departamento o laboratorio',
    required: false,
  },
  {
    name: 'city',
    placeholder: 'Ciudad',
    required: false,
  },
];

const STAT_ITEMS = [
  { status: ALL_STATUSES, label: 'Total' },
  { status: 'pending', label: 'En espera' },
  { status: 'replied', label: 'Respondidos' },
  { status: 'rejected', label: 'Rechazados' },
];

const renderStaleContact = contact => (
  <>
    <span className="stale-primary" title={contact.contact}>
      {contact.contact}
    </span>
    <span title={contact.institution}>{contact.institution}</span>
    <span className="stale-date">{contact.contactedAt}</span>
  </>
);

function Contacts({ collection, showForm, onCloseForm }) {
  const { items: contacts, staleItems, create, update, suspend } = collection;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [noteContact, setNoteContact] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);

  const filteredContacts = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return sortByDateDesc(
      contacts.filter(
        contact =>
          matchesText(
            [
              contact.contact,
              contact.institution,
              contact.department,
              contact.country,
              contact.city,
              contact.email,
              contact.notes,
            ],
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
    const today = new Date();
    const contactedAt = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    if (
      await create({
        ...values,
        contactedAt,
        status: 'pending',
        notes: '',
      })
    ) {
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
        itemType="contact"
        renderCells={renderStaleContact}
        onOpen={setSelectedContact}
        onSuspend={suspend}
      />

      {showForm && (
        <div className="record-form-wrapper">
          <RecordForm
            title="Nuevo contacto"
            requiredFields={REQUIRED_FORM_FIELDS}
            optionalFields={OPTIONAL_FORM_FIELDS}
            submitLabel="Guardar contacto"
            onSubmit={handleCreate}
            onCancel={onCloseForm}
          />
        </div>
      )}

      <main>
        <StatCards items={statItems} activeStatus={statusFilter} onSelect={handleStatClick} />

        <Toolbar
          search={search}
          placeholder="Buscar contacto, institución, email o notas..."
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
            onOpenDetail={setSelectedContact}
          />
        </section>

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </main>

      {noteContact && (
        <NoteForm
          item={noteContact}
          onSave={handleSaveNote}
          onCancel={() => setNoteContact(null)}
        />
      )}

      {selectedContact && (
        <RecordDetails
          item={selectedContact}
          kind="contact"
          isStale={staleItems.some(item => item.id === selectedContact.id)}
          onClose={() => setSelectedContact(null)}
          onSuspend={async id => {
            await suspend(id);
            setSelectedContact(null);
          }}
          onEditNotes={item => {
            setSelectedContact(null);
            setNoteContact(item);
          }}
        />
      )}
    </>
  );
}

export default Contacts;
