import { useEffect, useState } from 'react';
import Header from './components/Header';
import Stats from './components/Stats';
import Toolbar from './components/Toolbar';
import ApplicationForm from './components/ApplicationForm';
import OldApplicationsAlert from './components/OldApplicationsAlert';
import ApplicationsTable from './components/ApplicationsTable';
import Pagination from './components/Pagination';
import Contacts from './components/Contacts';

const ITEMS_PER_PAGE = 10;

const EMPTY_FORM = {
  company: '',
  position: '',
  location: '',
  type: '',
  appliedAt: '',
  status: 'pending',
};

function App() {
  const [applications, setApplications] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [oldApplications, setOldApplications] = useState([]);
  const [showOldApplications, setShowOldApplications] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [view, setView] = useState('applications');
  const [showContactForm, setShowContactForm] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [oldContacts, setOldContacts] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3001/api/applications')
      .then(response => {
        if (!response.ok) {
          throw new Error('No se pudieron cargar las candidaturas');
        }

        return response.json();
      })
      .then(data => {
        setApplications(data.applications);
      })
      .catch(error => {
        console.info('Error cargando las candidaturas:', error);
      });
  }, []);

  useEffect(() => {
    fetch('http://localhost:3001/api/applications/old')
      .then(response => {
        if (!response.ok) {
          throw new Error(
            'No se pudieron comprobar las candidaturas antiguas',
          );
        }

        return response.json();
      })
      .then(data => {
        setOldApplications(data.applications);
      })
      .catch(error => {
        console.info(
          'Error comprobando candidaturas antiguas:',
          error,
        );
      });
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, typeFilter]);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const response = await fetch(
          'http://localhost:3001/api/contacts',
        );

        if (!response.ok) {
          throw new Error(
            'No se pudieron cargar los contactos',
          );
        }

        const data = await response.json();

        setContacts(data);
      } catch (error) {
        console.info(
          'Error cargando los contactos:',
          error,
        );
      }
    };

    void loadContacts();
  }, []);

  useEffect(() => {
    const loadOldContacts = async () => {
      try {
        const response = await fetch(
          'http://localhost:3001/api/contacts/old',
        );

        if (!response.ok) {
          throw new Error(
            'No se pudieron cargar los contactos antiguos',
          );
        }

        const data = await response.json();

        setOldContacts(data.contacts);
      } catch (error) {
        console.info(
          'Error comprobando contactos antiguos:',
          error,
        );
      }
    };

    void loadOldContacts();
  }, []);

  const handleSubmit = async event => {
    event.preventDefault();

    try {
      const response = await fetch(
        'http://localhost:3001/api/applications',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        },
      );

      if (!response.ok) {
        throw new Error('No se pudo guardar la candidatura');
      }

      const newApplication = await response.json();

      setApplications(currentApplications => [
        ...currentApplications,
        newApplication,
      ]);

      setFormData(EMPTY_FORM);
      setShowForm(false);
    } catch (error) {
      console.info('Error guardando la candidatura:', error);
    }
  };

  const handleStatClick = status => {
    setStatusFilter(status);
  };

  const handleStatusChange = async (id, status) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/applications/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) {
        throw new Error('No se pudo actualizar el estado');
      }

      const updatedApplication = await response.json();

      setApplications(currentApplications =>
        currentApplications.map(application => {
          if (application.id === id) {
            return updatedApplication;
          }

          return application;
        }),
      );
    } catch (error) {
      console.info(
        'Error actualizando el estado:',
        error,
      );
    }
  };

  const handleSuspend = async id => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/applications/${id}/suspend`,
        {
          method: 'PATCH',
        },
      );

      if (!response.ok) {
        throw new Error(
          'No se pudo suspender la candidatura',
        );
      }

      const updatedApplication = await response.json();

      setApplications(currentApplications =>
        currentApplications.map(application => {
          if (application.id === id) {
            return updatedApplication;
          }

          return application;
        }),
      );

      setOldApplications(currentApplications => {
        const remainingApplications =
          currentApplications.filter(
            application => application.id !== id,
          );

        if (remainingApplications.length === 0) {
          setShowOldApplications(false);
        }

        return remainingApplications;
      });
    } catch (error) {
      console.info(
        'Error suspendiendo la candidatura:',
        error,
      );
    }
  };

  const matchesSearch = job => {
    const searchText = search.toLowerCase();

    const searchableFields = [
      job.company,
      job.position,
      job.location,
      job.type,
      job.field,
    ];

    return searchableFields.some(value =>
      (value || '').toLowerCase().includes(searchText),
    );
  };

  const matchesStatus = job => {
    if (statusFilter === '') {
      return true;
    }

    if (statusFilter === 'rejected') {
      return (
        job.status === 'rejected' ||
        job.status === 'suspended'
      );
    }

    return job.status === statusFilter;
  };

  const filteredApplications = applications
    .filter(matchesSearch)
    .filter(matchesStatus)
    .filter(
      job =>
        typeFilter === '' ||
        job.type === typeFilter,
    )
    .sort(
      (a, b) =>
        new Date(b.appliedAt) -
        new Date(a.appliedAt),
    );

  const totalPages = Math.ceil(
    filteredApplications.length / ITEMS_PER_PAGE,
  );

  const startIndex =
    (currentPage - 1) * ITEMS_PER_PAGE;

  const paginatedApplications =
    filteredApplications.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE,
    );

  const createContact = async contact => {
    try {
      const response = await fetch(
        'http://localhost:3001/api/contacts',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contact),
        },
      );

      if (!response.ok) {
        throw new Error(
          'No se pudo crear el contacto',
        );
      }

      const newContact = await response.json();

      setContacts(prev => [
        ...prev,
        newContact,
      ]);

      setShowContactForm(false);
    } catch (error) {
      console.info(
        'Error creando el contacto:',
        error,
      );
      throw error;
    }
  };

  const updateContact = async (id, changes) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/contacts/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(changes),
        },
      );

      if (!response.ok) {
        throw new Error(
          'No se pudo actualizar el contacto',
        );
      }

      const updatedContact =
        await response.json();

      setContacts(prev =>
        prev.map(contact => {
          if (contact.id === updatedContact.id) {
            return updatedContact;
          }

          return contact;
        }),
      );
    } catch (error) {
      console.info(
        'Error actualizando el contacto:',
        error,
      );
      throw error;
    }
  };

  const suspendContact = async id => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/contacts/${id}/suspend`,
        {
          method: 'PATCH',
        },
      );

      if (!response.ok) {
        throw new Error(
          'No se pudo suspender el contacto',
        );
      }

      const suspendedContact =
        await response.json();

      setContacts(prev => {
        const updatedContacts = [...prev];
        const contactIndex = updatedContacts.findIndex(
          contact => contact.id === suspendedContact.id,
        );

        if (contactIndex !== -1) {
          updatedContacts[contactIndex] = suspendedContact;
        }

        return updatedContacts;
      });

      setOldContacts(prev =>
        prev.filter(
          contact =>
            contact.id !== suspendedContact.id,
        ),
      );
    } catch (error) {
      console.info(
        'Error suspendiendo el contacto:',
        error,
      );
      throw error;
    }
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
          <OldApplicationsAlert
            applications={oldApplications}
            isOpen={showOldApplications}
            onToggle={() =>
              setShowOldApplications(
                current => !current,
              )
            }
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
            <Stats
              applications={applications}
              statusFilter={statusFilter}
              onStatusClick={handleStatClick}
            />

            <Toolbar
              search={search}
              typeFilter={typeFilter}
              onSearchChange={setSearch}
              onTypeChange={setTypeFilter}
            />

            <p>
              Mostrando {filteredApplications.length} de{' '}
              {applications.length} candidaturas
            </p>

            <ApplicationsTable
              applications={paginatedApplications}
              onStatusChange={handleStatusChange}
            />

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPrevious={() =>
                setCurrentPage(currentPage - 1)
              }
              onNext={() =>
                setCurrentPage(currentPage + 1)
              }
            />
          </main>
        </>
      )}

      {view === 'contacts' && (
        <Contacts
          contacts={contacts}
          oldContacts={oldContacts}
          showForm={showContactForm}
          onCloseForm={() =>
            setShowContactForm(false)
          }
          onCreateContact={createContact}
          onUpdateContact={updateContact}
          onSuspendContact={suspendContact}
        />
      )}
    </div>
  );
}

export default App;
