import { useState } from 'react';
import useCollection from './hooks/useCollection';
import Header from './components/Header';
import Applications from './components/Applications';
import Contacts from './components/Contacts';

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

  return (
    <div className="app">
      <Header
        view={view}
        onSwitchView={changeView}
        onNew={() => setShowForm(true)}
      />

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
