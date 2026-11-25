import { useState } from 'react';
import Applications from '../features/applications/Applications';
import Contacts from '../features/contacts/Contacts';
import Header from '../shared/components/Header';
import useCollection from '../shared/hooks/useCollection';

function App() {
  const [view, setView] = useState('applications');
  const [showForm, setShowForm] = useState(false);
  const applications = useCollection('applications');
  const contacts = useCollection('contacts');

  const closeForm = () => setShowForm(false);

  const changeView = nextView => {
    setView(nextView);
    closeForm();
  };

  const errors = [
    ...new Set(
      [
        applications.error,
        contacts.error,
        applications.alertsError,
        contacts.alertsError,
      ].filter(Boolean),
    ),
  ];

  return (
    <div className="app">
      <Header view={view} onSwitchView={changeView} onNew={() => setShowForm(true)} />

      {errors.length > 0 && (
        <p className="api-error" role="alert">
          {errors.join(' ')}
        </p>
      )}

      <div hidden={view !== 'applications'}>
        <Applications
          collection={applications}
          showForm={showForm && view === 'applications'}
          onCloseForm={closeForm}
        />
      </div>

      <div hidden={view !== 'contacts'}>
        <Contacts
          collection={contacts}
          showForm={showForm && view === 'contacts'}
          onCloseForm={closeForm}
        />
      </div>
    </div>
  );
}

export default App;
