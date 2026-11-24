import { useState } from 'react';
import { LABELS } from '../lib/labels';

function StaleItemsAlert({
  items = [],
  scheduledItems = [],
  singularLabel,
  pluralLabel,
  itemType,
  renderCells,
  onSuspend,
  onOpen,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScheduledOpen, setIsScheduledOpen] = useState(false);

  if (items.length === 0 && scheduledItems.length === 0) {
    return null;
  }

  const label = items.length === 1 ? singularLabel : pluralLabel;

  return (
    <>
      {items.length > 0 && (
        <>
          <div className="stale-alert">
            <span className="warning-icon">⚠️</span>

            <strong>
              {LABELS.alerts.staleMessage
                .replace('{count}', items.length)
                .replace('{label}', label)}
            </strong>

            <button type="button" onClick={() => setIsOpen(open => !open)} aria-expanded={isOpen}>
              {isOpen ? LABELS.alerts.hide : LABELS.alerts.review}
            </button>
          </div>

          {isOpen && (
            <div className="stale-panel">
              {items.map(item => (
                <div className={`stale-row stale-row--${itemType}`} key={item.id}>
                  {renderCells(item)}

                  <button
                    type="button"
                    className="secondary-button stale-detail-button"
                    onClick={() => onOpen?.(item)}
                  >
                    {LABELS.alerts.viewDetails}
                  </button>

                  <button
                    type="button"
                    className="suspend-button"
                    onClick={() => onSuspend(item.id)}
                  >
                    {LABELS.alerts.suspend}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {scheduledItems.length > 0 && (
        <>
          <div className="scheduled-alert">
            <span className="warning-icon">📅</span>

            <strong>
              {LABELS.alerts.scheduledMessage.replace('{count}', scheduledItems.length)}
            </strong>

            <button
              type="button"
              onClick={() => setIsScheduledOpen(open => !open)}
              aria-expanded={isScheduledOpen}
            >
              {isScheduledOpen ? LABELS.alerts.hide : LABELS.alerts.review}
            </button>
          </div>

          {isScheduledOpen && (
            <div className="scheduled-panel">
              {scheduledItems.map(item => (
                <div className={`stale-row stale-row--${itemType}`} key={item.id}>
                  {renderCells(item)}

                  <button
                    type="button"
                    className="secondary-button stale-detail-button"
                    onClick={() => onOpen?.(item)}
                  >
                    {LABELS.alerts.viewDetails}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export default StaleItemsAlert;
