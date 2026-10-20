function NoteButton({ contact, onOpen }) {
  const hasNote = Boolean(contact.notes?.trim());
  const label = hasNote ? 'Ver y editar nota' : 'Añadir nota';

  return (
    <button
      type="button"
      className={hasNote ? 'note-button has-note' : 'note-button'}
      title={label}
      aria-label={label}
      onClick={() => onOpen(contact)}
    >
      <span aria-hidden="true">{hasNote ? '📝' : '○'}</span>
    </button>
  );
}

export default NoteButton;
