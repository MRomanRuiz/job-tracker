import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import ContactForm from './ContactForm';
import NoteForm from './NoteForm';

const STATUS_LABELS = {
  pending: 'En espera',
  replied: 'Respondido',
  rejected: 'Rechazado',
  suspended: 'Suspendido',
};

const CONTACTS_PER_PAGE = 10;

const EMPTY_FORM = {
  contact: '',
  center: '',
  contactedAt: '',
  status: 'pending',
  notes: '',
};

const getContactStats = contacts => ({
  total: contacts.length,

  pending: contacts.filter(
    contact => contact.status === 'pending',
  ).length,

  replied: contacts.filter(
    contact => contact.status === 'replied',
  ).length,

  rejected: contacts.filter(
    contact =>
      contact.status === 'rejected' ||
      contact.status === 'suspended',
  ).length,
});

const matchesContactSearch = (
  contact,
  search,
) => {
  if (!search) {
    return true;
  }

  const searchableFields = [
    contact.contact,
    contact.center,
    contact.notes,
  ];

  return searchableFields.some(value =>
    (value || '').toLowerCase().includes(search),
  );
};

const matchesContactStatus = (
  contact,
  statusFilter,
) => {
  if (statusFilter === 'all') {
    return true;
  }

  if (statusFilter === 'rejected') {
    return (
      contact.status === 'rejected' ||
      contact.status === 'suspended'
    );
  }

  return contact.status === statusFilter;
};

function OldContactsAlert({
  contacts,
  isOpen,
  onToggle,
  onSuspend,
}) {
  if (contacts.length === 0) {
    return null;
  }

  let contactLabel = 'contactos pendientes';

  if (contacts.length === 1) {
    contactLabel = 'contacto pendiente';
  }

  let buttonLabel = 'Revisar';

  if (isOpen) {
    buttonLabel = 'Cancelar';
  }

  return (
    <>
      <div className="old-applications-alert">
        <span className="warning-icon">⚠️</span>

        <strong>
          Hay {contacts.length} {contactLabel} de
          más de 30 días.
        </strong>

        <button
          type="button"
          onClick={onToggle}
        >
          {buttonLabel}
        </button>
      </div>

      {isOpen && (
        <div className="old-applications-panel">
          {contacts.map(contact => (
            <div
              className="old-application-row"
              key={contact.id}
            >
              <span className="application-company">
                {contact.contact}
              </span>

              <span>{contact.center}</span>

              <span className="application-date">
                {contact.contactedAt}
              </span>

              <span>
                {contact.notes || '—'}
              </span>

              <button
                type="button"
                className="suspend-button"
                onClick={() =>
                  onSuspend(contact.id)
                }
              >
                Suspender
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ContactStats({
  stats,
  statusFilter,
  onStatusClick,
}) {
  const statItems = [
    {
      status: 'all',
      label: 'Total',
      value: stats.total,
    },
    {
      status: 'pending',
      label: 'En espera',
      value: stats.pending,
    },
    {
      status: 'replied',
      label: 'Respondidos',
      value: stats.replied,
    },
    {
      status: 'rejected',
      label: 'Rechazados',
      value: stats.rejected,
    },
  ];

  return (
    <section className="stats">
      {statItems.map(stat => {
        let activeClass = '';

        if (statusFilter === stat.status) {
          activeClass = 'active';
        }

        return (
          <button
            key={stat.status}
            type="button"
            className={`stat-card ${activeClass}`}
            onClick={() =>
              onStatusClick(stat.status)
            }
          >
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </button>
        );
      })}
    </section>
  );
}

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
              <select
                className={`status-select ${contact.status}`}
                value={contact.status}
                onChange={event =>
                  onStatusChange(
                    contact.id,
                    event.target.value,
                  )
                }
              >
                {contact.status !== 'suspended' && (
                  <option value="pending">
                    {STATUS_LABELS.pending}
                  </option>
                )}

                <option value="replied">
                  {STATUS_LABELS.replied}
                </option>

                <option value="rejected">
                  {STATUS_LABELS.rejected}
                </option>

                {contact.status === 'suspended' && (
                  <option value="suspended">
                    {STATUS_LABELS.suspended}
                  </option>
                )}
              </select>
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

function ContactPagination({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination">
      <button
        type="button"
        className="secondary-button"
        disabled={currentPage === 1}
        onClick={onPrevious}
      >
        ← Anterior
      </button>

      <span>
        Página {currentPage} de {totalPages}
      </span>

      <button
        type="button"
        className="secondary-button"
        disabled={
          currentPage === totalPages
        }
        onClick={onNext}
      >
        Siguiente →
      </button>
    </div>
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
  const [statusFilter, setStatusFilter] =
    useState('all');
  const [currentPage, setCurrentPage] =
    useState(1);
  const [form, setForm] =
    useState(EMPTY_FORM);
  const [showOldContacts, setShowOldContacts] =
    useState(false);

  const [
    selectedNoteContact,
    setSelectedNoteContact,
  ] = useState(null);

  const [noteValue, setNoteValue] =
    useState('');

  const stats = useMemo(
    () => getContactStats(contacts),
    [contacts],
  );

  const filteredContacts = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return contacts
      .filter(contact =>
        matchesContactSearch(
          contact,
          normalizedSearch,
        ),
      )
      .filter(contact =>
        matchesContactStatus(
          contact,
          statusFilter,
        ),
      )
      .sort(
        (a, b) =>
          new Date(b.contactedAt) -
          new Date(a.contactedAt),
      );
  }, [
    contacts,
    search,
    statusFilter,
  ]);

  const totalPages = Math.ceil(
    filteredContacts.length /
      CONTACTS_PER_PAGE,
  );

  const paginatedContacts = useMemo(() => {
    const startIndex =
      (currentPage - 1) *
      CONTACTS_PER_PAGE;

    return filteredContacts.slice(
      startIndex,
      startIndex + CONTACTS_PER_PAGE,
    );
  }, [
    filteredContacts,
    currentPage,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (
      totalPages > 0 &&
      currentPage > totalPages
    ) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleStatClick = status => {
    setStatusFilter(current => {
      if (current === status) {
        return 'all';
      }

      return status;
    });
  };

  const handleSubmit = async event => {
    event.preventDefault();

    try {
      await onCreateContact(form);
      setForm(EMPTY_FORM);
    } catch (error) {
      console.info(
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
      console.info(
        'Error actualizando el estado:',
        error,
      );
    }
  };

  const handleSuspendContact = async id => {
    try {
      await onSuspendContact(id);
    } catch (error) {
      console.info(
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
      console.info(
        'Error actualizando las notas:',
        error,
      );
    }
  };

  return (
    <>
      <OldContactsAlert
        contacts={oldContacts}
        isOpen={showOldContacts}
        onToggle={() =>
          setShowOldContacts(
            current => !current,
          )
        }
        onSuspend={handleSuspendContact}
      />

      <main>
        <section className="section-header">
          <div>
            <h2>Contactos</h2>
          </div>
        </section>

        <ContactStats
          stats={stats}
          statusFilter={statusFilter}
          onStatusClick={handleStatClick}
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
            onChange={event =>
              setSearch(event.target.value)
            }
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

        <ContactPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPrevious={() =>
            setCurrentPage(
              current => current - 1,
            )
          }
          onNext={() =>
            setCurrentPage(
              current => current + 1,
            )
          }
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
