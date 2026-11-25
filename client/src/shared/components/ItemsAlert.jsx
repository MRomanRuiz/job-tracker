import { useState } from 'react';
import { LABELS } from '../lib/labels';

function AttentionItemsAlert({
  items,
  singularLabel,
  pluralLabel,
  itemType,
  renderCells,
  onSuspend,
  onOpen,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const label = items.length === 1 ? singularLabel : pluralLabel;
  const message = (LABELS.alerts?.staleMessage ?? '{count} {label} necesitan atención.')
    .replace('{count}', items.length)
    .replace('{label}', label ?? '');

  return (
    <>
      <div className="stale-alert">
        <span className="warning-icon">⚠️</span>
        <strong>{message}</strong>
        <button type="button" onClick={() => setIsOpen(open => !open)} aria-expanded={isOpen}>
          {isOpen ? LABELS.alerts.hide : LABELS.alerts.review}
        </button>
      </div>

      {isOpen && (
        <div className="stale-panel">
          {items.map(item => (
            <div className={`stale-row stale-row--${itemType}`} key={item.id}>
              {renderCells(item, 'stale')}

              <button
                type="button"
                className="secondary-button stale-detail-button"
                onClick={() => onOpen?.(item)}
              >
                {LABELS.alerts.viewDetails}
              </button>

              <button type="button" className="suspend-button" onClick={() => onSuspend(item.id)}>
                {LABELS.alerts.suspend}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ScheduledItemsAlert({ items, itemType, renderCells, onOpen }) {
  const [isOpen, setIsOpen] = useState(false);
  const message = LABELS.alerts.scheduledMessage.replace('{count}', items.length);

  return (
    <>
      <div className="scheduled-alert">
        <span className="warning-icon">📅</span>
        <strong>{message}</strong>
        <button type="button" onClick={() => setIsOpen(open => !open)} aria-expanded={isOpen}>
          {isOpen ? LABELS.alerts.hide : LABELS.alerts.review}
        </button>
      </div>

      {isOpen && (
        <div className="scheduled-panel">
          {items.map(item => (
            <div className={`stale-row stale-row--${itemType}`} key={item.id}>
              {renderCells(item, 'scheduled')}

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
  );
}

function ItemsAlert({
  items = [],
  scheduledItems = [],
  singularLabel,
  pluralLabel,
  itemType,
  renderCells,
  onSuspend,
  onOpen,
}) {
  if (items.length === 0 && scheduledItems.length === 0) {
    return null;
  }

  return (
    <>
      {items.length > 0 && (
        <AttentionItemsAlert
          items={items}
          singularLabel={singularLabel}
          pluralLabel={pluralLabel}
          itemType={itemType}
          renderCells={renderCells}
          onSuspend={onSuspend}
          onOpen={onOpen}
        />
      )}

      {scheduledItems.length > 0 && (
        <ScheduledItemsAlert
          items={scheduledItems}
          itemType={itemType}
          renderCells={renderCells}
          onOpen={onOpen}
        />
      )}
    </>
  );
}

export default ItemsAlert;
