import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RecordForm from './RecordForm';

describe('RecordForm', () => {
  it('renders optional fields and converts numeric values on submit', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    render(
      <RecordForm
        title="Nuevo registro"
        requiredFields={[
          { name: 'title', placeholder: 'Título', required: true },
          {
            name: 'durationMonths',
            placeholder: 'Meses',
            type: 'number',
            required: true,
            min: 1,
            step: 1,
          },
        ]}
        optionalFields={[
          { name: 'details', placeholder: 'Detalles', type: 'textarea' },
        ]}
        submitLabel="Guardar"
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    expect(screen.queryByPlaceholderText('Detalles')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Mostrar campos opcionales' }),
    );
    fireEvent.change(screen.getByPlaceholderText('Título *'), {
      target: { value: 'Oferta' },
    });
    fireEvent.change(screen.getByPlaceholderText('Meses *'), {
      target: { value: '12' },
    });
    fireEvent.change(screen.getByPlaceholderText('Detalles'), {
      target: { value: 'Contrato temporal' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Oferta',
      durationMonths: 12,
      details: 'Contrato temporal',
    });
    expect(screen.getByRole('button', { name: 'Ocultar campos opcionales' }))
      .toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('submits an empty numeric field as null and hides optional fields', () => {
    const onSubmit = vi.fn();

    render(
      <RecordForm
        title="Nuevo registro"
        requiredFields={[
          { name: 'title', placeholder: 'Título', required: true },
          {
            name: 'durationMonths',
            placeholder: 'Meses',
            type: 'number',
          },
        ]}
        optionalFields={[
          { name: 'details', placeholder: 'Detalles', type: 'textarea' },
        ]}
        submitLabel="Guardar"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Título *'), {
      target: { value: 'Oferta' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Oferta',
      durationMonths: null,
      details: '',
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Mostrar campos opcionales' }),
    );
    expect(screen.getByPlaceholderText('Detalles')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Ocultar campos opcionales' }),
    );
    expect(screen.queryByPlaceholderText('Detalles')).toBeNull();
  });
});
