import { useMemo, useState } from 'react';
import { ALL_STATUSES, ITEMS_PER_PAGE } from '../constants';
import usePagination from '../hooks/usePagination';
import {
  countByStatus,
  matchesStatus,
  matchesText,
  sortByDateDesc,
} from '../utils';
import ApplicationsTable from './ApplicationsTable';
import Pagination from './Pagination';
import RecordForm from './RecordForm';
import StaleItemsAlert from './StaleItemsAlert';
import StatCards from './StatCards';
import Toolbar from './Toolbar';

const FORM_FIELDS = [
  { name: 'company', placeholder: 'Empresa' },
  { name: 'position', placeholder: 'Puesto' },
  { name: 'location', placeholder: 'Ubicación' },
  { name: 'type', placeholder: 'Tipo' },
  { name: 'appliedAt', type: 'date', required: true },
];

const STAT_ITEMS = [
  { status: ALL_STATUSES, label: 'Total' },
  { status: 'pending', label: 'En espera' },
  { status: 'interview', label: 'Entrevistas' },
  { status: 'rejected', label: 'Rechazadas' },
];

const renderStaleApplication = application => (
  <>
    <span className="stale-primary">{application.company}</span>
    <span>{application.position}</span>
    <span>{application.location}</span>
    <span>{application.type}</span>
    <span className="stale-date">{application.appliedAt}</span>
  </>
);

function Applications({ collection, showForm, onCloseForm }) {
  const { items: applications, staleItems, create, update, suspend } =
    collection;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [typeFilter, setTypeFilter] = useState('');

  const filteredApplications = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return sortByDateDesc(
      applications.filter(
        job =>
          matchesText(
            [job.company, job.position, job.location, job.type, job.field],
            searchText,
          ) &&
          matchesStatus(job, statusFilter) &&
          (typeFilter === '' || job.type === typeFilter),
      ),
      'appliedAt',
    );
  }, [applications, search, statusFilter, typeFilter]);

  const {
    page,
    totalPages,
    pageItems: paginatedApplications,
    setPage,
  } = usePagination(filteredApplications, ITEMS_PER_PAGE);

  const statItems = STAT_ITEMS.map(item => ({
    ...item,
    value: countByStatus(applications, item.status),
  }));

  const handleCreate = async values => {
    if (await create(values)) {
      onCloseForm();
    }
  };

  const handleStatClick = status => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleSearchChange = value => {
    setSearch(value);
    setPage(1);
  };

  const handleTypeChange = value => {
    setTypeFilter(value);
    setPage(1);
  };

  return (
    <>
      <StaleItemsAlert
        items={staleItems}
        singularLabel="candidatura pendiente"
        pluralLabel="candidaturas pendientes"
        renderCells={renderStaleApplication}
        onSuspend={suspend}
      />

      {showForm && (
        <RecordForm
          title="Nueva candidatura"
          fields={FORM_FIELDS}
          submitLabel="Guardar candidatura"
          onSubmit={handleCreate}
          onCancel={onCloseForm}
        />
      )}

      <main>
        <StatCards
          items={statItems}
          activeStatus={statusFilter}
          onSelect={handleStatClick}
        />

        <Toolbar
          search={search}
          placeholder="Buscar empresa, puesto..."
          onSearchChange={handleSearchChange}
        >
          <select
            value={typeFilter}
            onChange={event => handleTypeChange(event.target.value)}
          >
            <option value="">Todos los tipos</option>
            <option value="Empresa">Empresa</option>
            <option value="Investigación">Investigación</option>
          </select>
        </Toolbar>

        <p>
          Mostrando {filteredApplications.length} de {applications.length}{' '}
          {applications.length === 1 ? 'candidatura' : 'candidaturas'}
        </p>

        <section className="table-container">
          <ApplicationsTable
            applications={paginatedApplications}
            onStatusChange={(id, status) => update(id, { status })}
          />
        </section>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </main>
    </>
  );
}

export default Applications;
