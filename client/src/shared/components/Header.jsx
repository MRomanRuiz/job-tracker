import { LABELS } from '../lib/labels';

const VIEWS = {
  applications: {
    description: LABELS.header.applicationsDescription,
    switchLabel: LABELS.header.contacts,
    switchTo: 'contacts',
    newLabel: LABELS.header.newApplication,
  },
  contacts: {
    description: LABELS.header.contactsDescription,
    switchLabel: LABELS.header.applications,
    switchTo: 'applications',
    newLabel: LABELS.header.newContact,
  },
};

function Header({ view, onSwitchView, onNew }) {
  const { description, switchLabel, switchTo, newLabel } = VIEWS[view];

  return (
    <header className="header">
      <div>
        <h1>{LABELS.header.appName}</h1>
        <p>{description}</p>
      </div>

      <div className="header-actions">
        <button type="button" className="secondary-button" onClick={() => onSwitchView(switchTo)}>
          {switchLabel}
        </button>

        <button type="button" className="primary-button" onClick={onNew}>
          {newLabel}
        </button>
      </div>
    </header>
  );
}

export default Header;
