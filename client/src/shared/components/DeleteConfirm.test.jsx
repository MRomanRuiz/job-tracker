import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DeleteConfirm from './DeleteConfirm';
import { LABELS } from '../lib/labels';

describe('DeleteConfirm', () => {
  it('shows the provided title and message and calls the confirmation handler', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <DeleteConfirm
        title="Eliminar candidatura"
        message="No se puede deshacer."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const dialog = screen.getByRole('alertdialog', { name: 'Eliminar candidatura' });
    expect(dialog.getAttribute('aria-describedby')).toBe('delete-confirm-message');
    expect(screen.getByText('No se puede deshacer.')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: LABELS.common.deletePermanently }),
    );
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('uses the default title and cancels from the button or backdrop only', () => {
    const onCancel = vi.fn();

    const { container } = render(
      <DeleteConfirm message="Confirmación" onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    expect(screen.getByRole('alertdialog', { name: LABELS.deleteConfirm.title })).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole('alertdialog'));
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.mouseDown(container.firstChild);
    expect(onCancel).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: LABELS.common.cancel }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
