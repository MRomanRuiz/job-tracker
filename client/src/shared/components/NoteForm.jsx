import { useState } from 'react';

function NoteForm({ item, onSave, onCancel }) {
  const [note, setNote] = useState(item.notes || '');

  const handleSubmit = event => {
    event.preventDefault();
    onSave(note);
  };

  const title = item.contact || item.company || item.position;

  return (
    <div className="note-popup-overlay">
      <div
        className="note-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-popup-title"
      >
        <div className="note-popup-header">
          <div>
            <span className="note-popup-icon">📝</span>

            <div>
              <h3 id="note-popup-title">Nota</h3>
              <p>{title}</p>
            </div>
          </div>

          <button
            type="button"
            className="note-popup-close"
            onClick={onCancel}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="note-popup-body">
            <textarea
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="Escribe una nota..."
              rows="5"
              autoFocus
            />
          </div>

          <div className="note-popup-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onCancel}
            >
              Cancelar
            </button>

            <button type="submit" className="primary-button">
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NoteForm;
