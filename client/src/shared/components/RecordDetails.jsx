import { getRecordFields } from '../../lib/recordFields';
import RecordTimeline from './RecordTimeline';

function RecordDetails({ item, kind, isStale = false, onClose, onSuspend, onEdit }) {
  if (!item) {
    return null;
  }

  const fields = getRecordFields(kind);

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

        <RecordTimeline record={item} recordType={kind} />

        <footer className="record-details-actions">
          <button type="button" className="primary-button" onClick={() => onEdit?.(item)}>
            Editar
          </button>

          <button type="button" className="secondary-button" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </section>
    </div>
  );
}

export default RecordDetails;
