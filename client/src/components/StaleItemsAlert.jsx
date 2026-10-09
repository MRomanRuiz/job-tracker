import { useState } from 'react';

function StaleItemsAlert({
  items,
  singularLabel,
  pluralLabel,
  renderCells,
  onSuspend,
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (items.length === 0) {
    return null;
  }

  const label = items.length === 1 ? singularLabel : pluralLabel;

  return (
    <>
      <div className="old-applications-alert">
        <span className="warning-icon">⚠️</span>

        <strong>
          Hay {items.length} {label} de más de 30 días.
        </strong>

        <button type="button" onClick={() => setIsOpen(open => !open)}>
          {isOpen ? 'Cancelar' : 'Revisar'}
        </button>
      </div>

      {isOpen && (
        <div className="old-applications-panel">
          {items.map(item => (
            <div className="old-application-row" key={item.id}>
              {renderCells(item)}

              <button
                type="button"
                className="suspend-button"
                onClick={() => onSuspend(item.id)}
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

export default StaleItemsAlert;
