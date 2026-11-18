import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { mockApi } from '../test/helpers/mockApi';
import { LABELS } from '../shared/lib/labels';

const renderApp = () => {
  mockApi({
    'GET /api/applications': {
      applications: [
        {
          id: 1,
          company: 'Acme',
          position: 'Dev',
          country: 'España',
          city: 'Madrid',
          type: 'industry',
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
          email: 'ana@globex.com',
          institution: 'Globex',
          country: 'España',
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

    expect(screen.getByText(LABELS.header.applicationsDescription)).toBeTruthy();
    expect((await screen.findByText('Acme')).closest('[hidden]')).toBeNull();
    expect((await screen.findByText('Ana')).closest('[hidden]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: LABELS.header.contacts }));

    expect(screen.getByText(LABELS.header.contactsDescription)).toBeTruthy();
    expect(screen.getByText('Acme').closest('[hidden]')).not.toBeNull();
    expect(screen.getByText('Ana').closest('[hidden]')).toBeNull();
  });

  it('opens the form of the current view and closes it when switching', async () => {
    renderApp();
    await screen.findByText('Acme');

    fireEvent.click(screen.getByRole('button', { name: LABELS.header.newApplication }));
    expect(screen.getByText(LABELS.applications.newTitle)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: LABELS.header.contacts }));
    expect(screen.queryByText(LABELS.applications.newTitle)).toBeNull();
    expect(screen.queryByText(LABELS.contacts.newTitle)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: LABELS.header.newContact }));
    expect(screen.getByText(LABELS.contacts.newTitle)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: LABELS.common.cancel }));
    expect(screen.queryByText(LABELS.contacts.newTitle)).toBeNull();
  });

  it('shows the server message when a collection fails to load', async () => {
    mockApi({
      'GET /api/applications': {
        httpStatus: 500,
        body: { message: 'No se pudieron cargar las candidaturas' },
      },
      'GET /api/applications/old': { applications: [] },
      'GET /api/contacts': { contacts: [] },
      'GET /api/contacts/old': { contacts: [] },
    });

    render(<App />);

    expect(await screen.findByText('No se pudieron cargar las candidaturas')).toBeTruthy();
  });

  it('shows one specific alert when both collections fail with a bad gateway', async () => {
    mockApi({
      'GET /api/applications': { httpStatus: 502, body: {} },
      'GET /api/applications/old': { applications: [] },
      'GET /api/contacts': { httpStatus: 502, body: {} },
      'GET /api/contacts/old': { contacts: [] },
    });

    render(<App />);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toBe(
      LABELS.common.badGatewayError,
    );
  });
});
