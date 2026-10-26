import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_TYPE_LABELS,
  CONTACT_STATUS_LABELS,
} from '../lib/constants';
import { formatDate } from '../lib/utils';

const APPLICATION_FIELDS = [
  { name: 'company', label: 'Empresa' },
  { name: 'position', label: 'Puesto' },
  {
    name: 'type',
    label: 'Tipo',
    format: value => APPLICATION_TYPE_LABELS[value] || value,
  },
  { name: 'country', label: 'País' },
  { name: 'city', label: 'Ciudad' },
  { name: 'appliedAt', label: 'Fecha de candidatura', format: formatDate },
  {
    name: 'durationType',
    label: 'Tipo de contrato',
    format: value =>
      ({
        fixed: 'Temporal',
        indefinite: 'Indefinido',
      })[value] || '—',
  },
  {
    name: 'durationMonths',
    label: 'Duración (meses)',
    format: value => value ?? '—',
  },
  {
    name: 'status',
    label: 'Estado',
    badge: true,
    format: value => APPLICATION_STATUS_LABELS[value] || value,
  },
  { name: 'notes', label: 'Notas', multiline: true },
];

const CONTACT_FIELDS = [
  { name: 'contact', label: 'Nombre' },
  { name: 'email', label: 'Email / Contacto' },
  { name: 'institution', label: 'Empresa o universidad' },
  { name: 'department', label: 'Departamento o laboratorio' },
  { name: 'city', label: 'Ciudad' },
  { name: 'country', label: 'País' },
  { name: 'contactedAt', label: 'Fecha de contacto', format: formatDate },
  {
    name: 'status',
    label: 'Estado',
    badge: true,
    format: value => CONTACT_STATUS_LABELS[value] || value,
  },
  { name: 'notes', label: 'Notas', multiline: true },
];

function RecordDetails({ item, kind, isStale = false, onClose, onSuspend }) {
  if (!item) {
    return null;
  }

  const fields = kind === 'application' ? APPLICATION_FIELDS : CONTACT_FIELDS;

  const getRecordTitle = () => {
    if (kind === 'application') {
      const position = item.position || 'Candidatura';
      const company = item.company || '';

      return company ? `${position} — ${company}` : position;
    }

    const contact = item.contact || 'Contacto';
    const institution = item.institution || '';

    return institution ? `${contact} — ${institution}` : contact;
  };

  const title = getRecordTitle();

  const handleBackdropClick = event => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="record-details-backdrop"
      onMouseDown={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <section
        className="record-details"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-details-title"
      >
        <header className="record-details-header">
          <div>
            <h2 id="record-details-title">{title}</h2>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            ✕
          </button>
        </header>

        {isStale && item.status === 'pending' && (
          <div className="stale-alert record-details-alert">
            <span className="warning-icon">⚠️</span>

            <div>
              <strong>Registro pendiente de más de 30 días</strong>
            </div>

            <button type="button" className="suspend-button" onClick={() => onSuspend(item.id)}>
              Suspender
            </button>
          </div>
        )}

        <div className="record-details-grid">
          {fields.map(field => {
            const rawValue = item[field.name];
            let value = '—';

            if (rawValue !== null && rawValue !== undefined && rawValue !== '') {
              value = field.format ? field.format(rawValue) : rawValue;
            }

            return (
              <div
                className={`record-details-field${
                  field.multiline ? ' record-details-field-wide' : ''
                }`}
                key={field.name}
              >
                <span className="record-details-label">{field.label}</span>

                <div className="record-details-value">
                  {field.badge ? (
                    <span className={`status-badge ${rawValue}`}>{String(value)}</span>
                  ) : (
                    String(value)
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="record-details-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </section>
    </div>
  );
}

export default RecordDetails;
