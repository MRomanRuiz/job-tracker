import { LABELS } from '../lib/labels';

function DeleteConfirm({ title = LABELS.deleteConfirm.title, message, onConfirm, onCancel }) {
  return (
    <div
      className="delete-confirm-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <section
        className="delete-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-message"
      >
        <div className="delete-confirm-icon">⚠️</div>

        <h2 id="delete-confirm-title">{title}</h2>

        <p id="delete-confirm-message">{message}</p>

        <div className="delete-confirm-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            {LABELS.common.cancel}
          </button>

          <button type="button" className="delete-button" onClick={onConfirm}>
            {LABELS.common.deletePermanently}
          </button>
        </div>
      </section>
    </div>
  );
}

export default DeleteConfirm;
