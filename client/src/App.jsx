import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from './api';
import {
  ALL_STATUSES,
  APPLICATION_STATUS_LABELS,
  ITEMS_PER_PAGE,
} from './constants';
import usePagination from './hooks/usePagination';
import {
  countByStatus,
  getStalePending,
  matchesStatus,
  matchesText,
  replaceById,
  sortByDateDesc,
} from './utils';
import Header from './components/Header';
import StatCards from './components/StatCards';
import Toolbar from './components/Toolbar';
import ApplicationForm from './components/ApplicationForm';
import StaleItemsAlert from './components/StaleItemsAlert';
import ApplicationsTable from './components/ApplicationsTable';
import Pagination from './components/Pagination';
import Contacts from './components/Contacts';

const EMPTY_FORM = {
  company: '',
  position: '',
  location: '',
  type: '',
  appliedAt: '',
  status: 'pending',
};

const STAT_ITEMS = [
  { status: ALL_STATUSES, label: 'Total' },
  { status: 'pending', label: 'En espera' },
  { status: 'interview', label: 'Entrevistas' },
  { status: 'rejected', label: 'Rechazadas' },
];

const renderStaleApplication = application => (
  <>
    <span className="application-company">{application.company}</span>
    <span>{application.position}</span>
    <span>{application.location}</span>
    <span>{application.type}</span>
    <span className="application-date">{application.appliedAt}</span>
  </>
);

function App() {
  const [applications, setApplications] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [view, setView] = useState('applications');
  const [showContactForm, setShowContactForm] = useState(false);
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    apiRequest('/applications')
      .then(data => setApplications(data.applications))
      .catch(error =>
        console.error('Error cargando las candidaturas:', error),
      );

    apiRequest('/contacts')
      .then(data => setContacts(data.contacts))
      .catch(error =>
        console.error('Error cargando los contactos:', error),
      );
  }, []);

  const oldApplications = useMemo(
    () => getStalePending(applications, 'appliedAt'),
    [applications],
  );

  const oldContacts = useMemo(
    () => getStalePending(contacts, 'contactedAt'),
    [contacts],
  );

  const filteredApplications = useMemo(() => {
    const searchText = search.toLowerCase();

    return sortByDateDesc(
      applications.filter(
        job =>
          matchesText(
            [job.company, job.position, job.location, job.type, job.field],
            searchText,
          ) &&
          matchesStatus(job, statusFilter) &&
          (typeFilter === '' || job.type === typeFilter),
      ),
      'appliedAt',
    );
  }, [applications, search, statusFilter, typeFilter]);

  const {
    page,
    totalPages,
    pageItems: paginatedApplications,
    setPage,
  } = usePagination(filteredApplications, ITEMS_PER_PAGE);

  const statItems = STAT_ITEMS.map(item => ({
    ...item,
    value: countByStatus(applications, item.status),
  }));

  const handleSubmit = async event => {
    event.preventDefault();

    try {
      const newApplication = await apiRequest('/applications', {
        method: 'POST',
        body: formData,
      });

      setApplications(current => [...current, newApplication]);
      setFormData(EMPTY_FORM);
      setShowForm(false);
    } catch (error) {
      console.error('Error guardando la candidatura:', error);
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

  const handleTypeChange = value => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleStatusChange = async (id, status) => {
    try {
      const updatedApplication = await apiRequest(`/applications/${id}`, {
        method: 'PATCH',
        body: { status },
      });

      setApplications(current => replaceById(current, updatedApplication));
    } catch (error) {
      console.error('Error actualizando el estado:', error);
    }
  };

  const handleSuspend = async id => {
    try {
      const updatedApplication = await apiRequest(
        `/applications/${id}/suspend`,
        { method: 'PATCH' },
      );

      setApplications(current => replaceById(current, updatedApplication));
    } catch (error) {
      console.error('Error suspendiendo la candidatura:', error);
    }
  };

  const createContact = async contact => {
    const newContact = await apiRequest('/contacts', {
      method: 'POST',
      body: contact,
    });

    setContacts(current => [...current, newContact]);
    setShowContactForm(false);
  };

  const updateContact = async (id, changes) => {
    const updatedContact = await apiRequest(`/contacts/${id}`, {
      method: 'PATCH',
      body: changes,
    });

    setContacts(current => replaceById(current, updatedContact));
  };

  const suspendContact = async id => {
    const suspendedContact = await apiRequest(`/contacts/${id}/suspend`, {
      method: 'PATCH',
    });

    setContacts(current => replaceById(current, suspendedContact));
  };

  return (
    <div className="app">
      <Header
        view={view}
        onNewApplication={() => setShowForm(true)}
        onContacts={() => setView('contacts')}
        onBackToApplications={() => {
          setView('applications');
          setShowContactForm(false);
        }}
        onNewContact={() => setShowContactForm(true)}
      />

      {view === 'applications' && (
        <>
          <StaleItemsAlert
            items={oldApplications}
            singularLabel="candidatura pendiente"
            pluralLabel="candidaturas pendientes"
            renderCells={renderStaleApplication}
            onSuspend={handleSuspend}
          />

          {showForm && (
            <ApplicationForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleSubmit}
              onCancel={() => setShowForm(false)}
            />
          )}

          <main>
            <StatCards
              items={statItems}
              activeStatus={statusFilter}
              onSelect={handleStatClick}
            />

            <Toolbar
              search={search}
              typeFilter={typeFilter}
              onSearchChange={handleSearchChange}
              onTypeChange={handleTypeChange}
            />

            <p>
              Mostrando {filteredApplications.length} de{' '}
              {applications.length} candidaturas
            </p>

            <ApplicationsTable
              applications={paginatedApplications}
              statusLabels={APPLICATION_STATUS_LABELS}
              onStatusChange={handleStatusChange}
            />

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </main>
        </>
      )}

      {view === 'contacts' && (
        <Contacts
          contacts={contacts}
          oldContacts={oldContacts}
          showForm={showContactForm}
          onCloseForm={() => setShowContactForm(false)}
          onCreateContact={createContact}
          onUpdateContact={updateContact}
          onSuspendContact={suspendContact}
        />
      )}
    </div>
  );
}

export default App;
