import { useMemo, useState } from 'react';
import { ALL_STATUSES, APPLICATION_TYPE_LABELS, ITEMS_PER_PAGE } from '../../shared/lib/constants';
import usePagination from '../../shared/hooks/usePagination';
import { countByStatus, matchesStatus, matchesText, sortByDateDesc } from '../../shared/lib/utils';
import ApplicationsTable from './ApplicationsTable';
import Pagination from '../../shared/components/Pagination';
import RecordForm from '../../shared/components/RecordForm';
import StaleItemsAlert from '../../shared/components/StaleItemsAlert';
import StatCards from '../../shared/components/StatCards';
import Toolbar from '../../shared/components/Toolbar';
import NoteForm from '../../shared/components/NoteForm';
import RecordDetails from '../../shared/components/RecordDetails';

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
    emptyOptionValue: 'unknown',
    options: [
      { value: 'unknown', label: 'Desconocido' },
      { value: 'fixed', label: 'Temporal' },
      { value: 'indefinite', label: 'Indefinido' },
    ],
    required: false,
  },
  {
    name: 'durationMonths',
    placeholder: 'Duración en meses (si es temporal)',
    type: 'number',
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
    <span className="stale-primary" title={application.company}>
      {application.company}
    </span>
    <span title={application.position}>{application.position}</span>
    <span>{APPLICATION_TYPE_LABELS[application.type] || application.type}</span>
    <span className="stale-date">{application.appliedAt}</span>
  </>
);

function Applications({ collection, showForm, onCloseForm }) {
  const { items: applications, staleItems, create, update, suspend } = collection;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [typeFilter, setTypeFilter] = useState('');
  const [noteApplication, setNoteApplication] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);

  const filteredApplications = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return sortByDateDesc(
      applications.filter(
        job =>
          matchesText(
            [job.company, job.position, job.country, job.type, job.city, job.notes],
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
        itemType="application"
        renderCells={renderStaleApplication}
        onSuspend={suspend}
        onOpen={setSelectedApplication}
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
        <StatCards items={statItems} activeStatus={statusFilter} onSelect={handleStatClick} />

        <Toolbar
          search={search}
          placeholder="Buscar empresa, puesto..."
          onSearchChange={handleSearchChange}
        >
          <select value={typeFilter} onChange={event => handleTypeChange(event.target.value)}>
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
            onOpenDetail={setSelectedApplication}
          />
        </section>

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </main>
      {noteApplication && (
        <NoteForm
          item={noteApplication}
          onSave={handleSaveNote}
          onCancel={() => setNoteApplication(null)}
        />
      )}

      {selectedApplication && (
        <RecordDetails
          item={selectedApplication}
          kind="application"
          isStale={staleItems.some(item => item.id === selectedApplication.id)}
          onClose={() => setSelectedApplication(null)}
          onSuspend={async id => {
            await suspend(id);
            setSelectedApplication(null);
          }}
          onEditNotes={item => {
            setSelectedApplication(null);
            setNoteApplication(item);
          }}
        />
      )}
    </>
  );
}

export default Applications;
