import { useMemo, useState } from 'react';
import { ALL_STATUSES, ITEMS_PER_PAGE } from '../../shared/lib/constants';
import { LABELS } from '../../shared/lib/labels';
import usePagination from '../../shared/hooks/usePagination';
import {
  countByStatus,
  formatDate,
  matchesStatus,
  matchesText,
  sortByDateDesc,
} from '../../shared/lib/utils';
import ContactsTable from './ContactsTable';
import NoteForm from '../../shared/components/NoteForm';
import Pagination from '../../shared/components/Pagination';
import RecordForm from '../../shared/components/RecordForm';
import ItemsAlert from '../../shared/components/ItemsAlert';
import StatCards from '../../shared/components/StatCards';
import Toolbar from '../../shared/components/Toolbar';
import RecordDetails from '../../shared/components/RecordDetails';
import RecordEditForm from '../../shared/components/RecordEditForm';
import { getRecordCreateFields } from '../../lib/recordFields';
import DeleteConfirm from '../../shared/components/DeleteConfirm';
import ScheduleFollowUpModal from '../../shared/components/ScheduleFollowUpModal';

const CONTACT_CREATE_FIELDS = getRecordCreateFields('contact');
const REQUIRED_FORM_FIELDS = CONTACT_CREATE_FIELDS.filter(field => field.required);
const OPTIONAL_FORM_FIELDS = CONTACT_CREATE_FIELDS.filter(field => !field.required);

const STAT_ITEMS = [
  { status: ALL_STATUSES, label: LABELS.contacts.stats.total },
  { status: 'pending', label: LABELS.contacts.stats.pending },
  { status: 'in_conversation', label: LABELS.contacts.stats.in_conversation },
  { status: 'rejected', label: LABELS.contacts.stats.rejected },
];

const renderStaleContact = (contact, alertType) => (
  <>
    <span className="stale-primary" title={contact.contact}>
      {contact.contact}
    </span>

    <span title={contact.institution}>{contact.institution}</span>

    <span className="stale-date">
      {formatDate(alertType === 'scheduled' ? contact.scheduledAt : contact.contactedAt)}
    </span>
  </>
);

function Contacts({ collection, showForm, onCloseForm }) {
  const {
    items: contacts,
    staleItems = [],
    create,
    update,
    suspend,
    recontact,
    remove,
    scheduledItems = [],
  } = collection;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [noteContact, setNoteContact] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  const [deletingContact, setDeletingContact] = useState(null);
  const [followUpContact, setFollowUpContact] = useState(null);

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
    const contactedAt = new Date().toISOString();

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
    setStatusFilter(status);
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

  const handleDelete = id => {
    setDeletingContact(id);
  };

  const confirmDelete = async () => {
    if (await remove(deletingContact)) {
      setSelectedContact(null);
      setDeletingContact(null);
    }
  };

  const handleStatusChange = (id, status) => {
    if (status === 'follow_up') {
      const contact = contacts.find(item => item.id === id);

      if (contact) {
        setFollowUpContact(contact);
      }

      return;
    }

    update(id, { status });
  };

  const handleSaveFollowUp = async date => {
    const updated = await update(followUpContact.id, {
      status: 'follow_up',
      scheduledAt: new Date(date).toISOString(),
    });

    if (!updated) {
      return false;
    }

    setFollowUpContact(null);
    return true;
  };

  const handleRecontact = async id => {
    if (await recontact(id)) {
      setSelectedContact(null);
    }
  };

  return (
    <>
      <ItemsAlert
        items={staleItems}
        scheduledItems={scheduledItems}
        singularLabel={LABELS.contacts.pendingSingular}
        pluralLabel={LABELS.contacts.pendingPlural}
        itemType="contact"
        renderCells={renderStaleContact}
        onOpen={setSelectedContact}
        onSuspend={suspend}
        onRecontact={handleRecontact}
      />

      {showForm && (
        <div className="record-form-wrapper">
          <RecordForm
            title={LABELS.contacts.newTitle}
            requiredFields={REQUIRED_FORM_FIELDS}
            optionalFields={OPTIONAL_FORM_FIELDS}
            submitLabel={LABELS.contacts.save}
            onSubmit={handleCreate}
            onCancel={onCloseForm}
          />
        </div>
      )}

      <main>
        <StatCards items={statItems} activeStatus={statusFilter} onSelect={handleStatClick} />

        <Toolbar
          search={search}
          placeholder={LABELS.contacts.searchPlaceholder}
          onSearchChange={handleSearchChange}
        />

        <p>
          {LABELS.contacts.showing} {filteredContacts.length} {LABELS.pagination.of}{' '}
          {contacts.length}{' '}
          {contacts.length === 1 ? LABELS.contacts.singular : LABELS.contacts.plural}
        </p>

        <section className="table-container">
          <ContactsTable
            contacts={paginatedContacts}
            onStatusChange={handleStatusChange}
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
          isScheduled={scheduledItems.some(item => item.id === selectedContact.id)}
          onClose={() => setSelectedContact(null)}
          onSuspend={async id => {
            await suspend(id);
            setSelectedContact(null);
          }}
          onRecontact={handleRecontact}
          onEditNotes={item => {
            setSelectedContact(null);
            setNoteContact(item);
          }}
          onEdit={item => {
            setSelectedContact(null);
            setEditingContact(item);
          }}
          onDelete={handleDelete}
        />
      )}

      {editingContact && (
        <RecordEditForm
          item={editingContact}
          kind="contact"
          onSave={update}
          onClose={updatedItem => {
            setEditingContact(null);
            setSelectedContact(updatedItem ?? editingContact);
          }}
        />
      )}

      {deletingContact !== null && (
        <DeleteConfirm
          title={LABELS.contacts.deleteTitle}
          message={LABELS.contacts.deleteMessage}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingContact(null)}
        />
      )}

      {followUpContact && (
        <ScheduleFollowUpModal
          item={followUpContact}
          itemType="contact"
          dateOnly
          onSave={handleSaveFollowUp}
          onCancel={() => setFollowUpContact(null)}
        />
      )}
    </>
  );
}

export default Contacts;
