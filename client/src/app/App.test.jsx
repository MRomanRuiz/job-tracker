import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { mockApi } from '../test/helpers/mockApi';

const renderApp = () => {
  mockApi({
    'GET /api/applications': {
      applications: [
        {
          id: 1,
          company: 'Acme',
          position: 'Dev',
          location: 'Madrid',
          type: 'Empresa',
          appliedAt: '2026-01-01',
          status: 'pending',
        },
      ],
    },
    'GET /api/applications/old': { applications: [] },
    'GET /api/contacts': {
      contacts: [
        {
          id: 1,
          contact: 'Ana',
          center: 'Globex',
          contactedAt: '2026-01-01',
          status: 'pending',
          notes: '',
        },
      ],
    },
    'GET /api/contacts/old': { contacts: [] },
  });

  render(<App />);
};

describe('App', () => {
  it('loads both collections and switches between views', async () => {
    renderApp();

    expect(screen.getByText('Control de tus candidaturas')).toBeTruthy();
    expect((await screen.findByText('Acme')).closest('[hidden]')).toBeNull();
    expect((await screen.findByText('Ana')).closest('[hidden]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Contactos' }));

    expect(screen.getByText('Control de tus contactos')).toBeTruthy();
    expect(screen.getByText('Acme').closest('[hidden]')).not.toBeNull();
    expect(screen.getByText('Ana').closest('[hidden]')).toBeNull();
  });

  it('opens the form of the current view and closes it when switching', async () => {
    renderApp();
    await screen.findByText('Acme');

    fireEvent.click(screen.getByRole('button', { name: '+ Nueva candidatura' }));
    expect(screen.getByText('Nueva candidatura')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Contactos' }));
    expect(screen.queryByText('Nueva candidatura')).toBeNull();
    expect(screen.queryByText('Nuevo contacto')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo contacto' }));
    expect(screen.getByText('Nuevo contacto')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('Nuevo contacto')).toBeNull();
  });
});
