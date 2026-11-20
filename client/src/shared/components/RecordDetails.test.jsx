import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RecordDetails from './RecordDetails';
import { LABELS } from '../lib/labels';

describe('RecordDetails', () => {
  it('renders nothing when no record is selected', () => {
    const { container } = render(<RecordDetails item={null} kind="application" />);

    expect(container.firstChild).toBeNull();
  });

  it('uses the default application title and allows an omitted delete handler', () => {
    render(
      <RecordDetails item={{ id: 1 }} kind="application" onClose={vi.fn()} onEdit={vi.fn()} />,
    );

    expect(
      screen.getByRole('heading', { name: LABELS.recordDetails.applicationFallback }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: LABELS.common.delete }));
  });

  it('uses the default contact title when contact and institution are missing', () => {
    render(<RecordDetails item={{ id: 2 }} kind="contact" onClose={vi.fn()} onEdit={vi.fn()} />);

    expect(
      screen.getByRole('heading', { name: LABELS.recordDetails.contactFallback }),
    ).toBeTruthy();
  });
});
