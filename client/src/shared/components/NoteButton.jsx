import { LABELS } from '../lib/labels';

function NoteButton({ item, onOpen }) {
  const hasNote = Boolean(item.notes?.trim());
  const label = hasNote ? LABELS.noteForm.viewAndEdit : LABELS.noteForm.add;

  return (
    <button
      type="button"
      className={hasNote ? 'note-button has-note' : 'note-button'}
      title={label}
      aria-label={label}
      onClick={() => onOpen(item)}
    >
      <span aria-hidden="true">{hasNote ? '📝' : '○'}</span>
    </button>
  );
}

export default NoteButton;
