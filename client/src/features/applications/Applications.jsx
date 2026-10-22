import { useMemo, useState } from 'react';
import { ALL_STATUSES, ITEMS_PER_PAGE } from '../../shared/lib/constants';
import usePagination from '../../shared/hooks/usePagination';
import {
  countByStatus,
  matchesStatus,
  matchesText,
  sortByDateDesc,
} from '../../shared/lib/utils';
import ApplicationsTable from './ApplicationsTable';
import Pagination from '../../shared/components/Pagination';
import RecordForm from '../../shared/components/RecordForm';
import StaleItemsAlert from '../../shared/components/StaleItemsAlert';
import StatCards from '../../shared/components/StatCards';
import Toolbar from '../../shared/components/Toolbar';
import NoteForm from '../../shared/components/NoteForm';

const REQUIRED_FORM_FIELDS = [
  {
    name: 'position',
    placeholder: 'Puesto',
    required: true,
  },
  {
    name: 'company',
    placeholder: 'Empresa',
    required: true,
  },
  {
    name: 'type',
    placeholder: 'Tipo',
    type: 'select',
    required: true,
    options: [
      { value: 'industry', label: 'Empresa' },
      { value: 'research', label: 'Investigación' },
    ],
  },
  {
    name: 'country',
    placeholder: 'País',
    required: true,
  },
];

const OPTIONAL_FORM_FIELDS = [
  {
    name: 'city',
    placeholder: 'Ciudad',
    required: false,
  },
  {
    name: 'durationType',
    placeholder: 'Tipo de contrato',
    type: 'select',
    initialValue: '',
    options: [
      { value: 'fixed', label: 'Temporal' },
      { value: 'indefinite', label: 'Indefinido' },
    ],
    required: false,
  },
  {
    name: 'durationMonths',
    placeholder: 'Duración (meses)',
    type: 'number',
    min: 1,
    step: 1,
    required: false,
  },
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
  const [noteApplication, setNoteApplication] = useState(null);

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
    const today = new Date();
    const appliedAt = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    if (await create({ ...values, notes: '', appliedAt })) {
      onCloseForm();
    }
  };

  const handleSaveNote = async notes => {
    if (await update(noteApplication.id, { notes })) {
      setNoteApplication(null);
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
        <div className="record-form-wrapper">
          <RecordForm
            title="Nueva candidatura"
            requiredFields={REQUIRED_FORM_FIELDS}
            optionalFields={OPTIONAL_FORM_FIELDS}
            submitLabel="Guardar candidatura"
            onSubmit={handleCreate}
            onCancel={onCloseForm}
          />
        </div>
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
            <option value="industry">Empresa</option>
            <option value="research">Investigación</option>
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
            onOpenNote={setNoteApplication}
          />
        </section>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </main>
      {noteApplication && (
        <NoteForm
          item={noteApplication}
          onSave={handleSaveNote}
          onCancel={() => setNoteApplication(null)}
        />
      )}
    </>
  );
}

export default Applications;
