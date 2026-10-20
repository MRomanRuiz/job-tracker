# Job Tracker

A small full-stack application for tracking job applications and professional contacts. The React interface lets you review and update application and contact statuses, while an Express API stores records using either local JSON files or MongoDB.

## Features

- Track job applications and professional contacts in the same dashboard.
- Create applications with a company, position, location, type, and additional details. The application date is assigned automatically when creating a record through the frontend.
- Search applications by company, position, location, type, or field.
- Filter applications by type or status and view summary counts.
- Browse results in pages of 10, sorted by application date (newest first).
- Review pending applications that have been open for more than 30 days and suspend them.
- Manage contacts with a name, center/company, automatically assigned contact date, status, and personal notes. The contact date is assigned automatically in the same way as the application date.
- Search, filter, and paginate contacts, including notes-based searches.
- Add and edit notes for each contact through a dedicated modal window.
- Review pending contacts older than 30 days and suspend them.
- Persist data using either local JSON files or MongoDB.
- Run backend tests against both storage implementations.

## Tech stack

- **Frontend:** React 19, Vite 8
- **Backend:** Node.js, Express 5
- **Testing:** Node.js test runner, Vitest, React Testing Library
- **Code quality:** ESLint
- **Coverage:** c8 for the backend and Vitest's V8 coverage provider for the frontend
- **Storage:** Pluggable JSON-file and MongoDB backends

## Prerequisites

- Node.js version specified in `.nvmrc`.
- npm (included with Node.js).
- MongoDB, running locally, to run the backend tests with MongoDB storage.

## Getting started

Install dependencies for the root project, backend, and frontend:

```sh
npm run install:all
```

Start the API and frontend together from the project root:

```sh
npm run dev
```

The API listens at [http://localhost:3001](http://localhost:3001). Open the local URL printed by Vite, usually [http://localhost:5173](http://localhost:5173). Vite proxies `/api` requests to the backend.

You can also run each part separately.

From the `server` directory:

```sh
npm start
```

Or start the backend in development mode, with automatic restarts on changes:

```sh
npm run dev
```

From the `client` directory:

```sh
npm run dev
```

## Available scripts

### From the project root

| Command | Description |
| --- | --- |
| `npm run install:all` | Install dependencies for the root, backend, and frontend. |
| `npm run dev` | Start the API and Vite development server concurrently. |
| `npm run lint` | Run ESLint on the backend and frontend. |
| `npm test` | Run backend tests with JSON and MongoDB storage, followed by frontend tests. All suites run even if one fails, and the command exits with an error if any suite fails. |
| `npm run test:json` | Run backend tests using JSON storage. |
| `npm run test:mongodb` | Run backend tests using MongoDB storage. |
| `npm run test:client` | Run frontend tests with Vitest and coverage. |
| `npm run build` | Build the frontend for production in `client/dist`. |

### From `client`

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Build the frontend for production. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint on the frontend. |
| `npm test` | Run Vitest tests and generate coverage reports. |

### From `server`

| Command | Description |
| --- | --- |
| `npm start` | Start the API server. |
| `npm run dev` | Start the API with automatic restarts on changes. |
| `npm run lint` | Run ESLint on the backend. |
| `npm test` | Run backend tests and generate coverage reports. |

## Continuous integration

GitHub Actions runs the CI workflow on every pull request and every push to `master`.

The workflow:

- Checks out the repository.
- Sets up the Node.js version specified in `.nvmrc`.
- Installs root, backend, and frontend dependencies using `npm ci`.
- Runs ESLint on the backend and frontend.
- Runs backend tests using JSON storage with temporary data files.
- Runs backend tests using MongoDB storage against a dedicated test database (`job_tracker_test`).
- Runs frontend tests using Vitest and its V8 coverage provider.
- Uploads coverage reports as a downloadable GitHub Actions artifact.
- Builds the frontend for production.

The MongoDB test service uses an isolated test database. Test configuration must never point to a production database or a database containing personal data.

Coverage artifacts are retained for 14 days. They can be downloaded from the **Artifacts** section of a completed workflow run.

The workflow uses read-only repository permissions and cancels superseded runs for the same branch or pull request.

The CI currently reports coverage but does not enforce minimum coverage thresholds.

## Data storage

The backend supports two storage implementations.

- **JSON:** Stores applications and contacts in `jobs.json` and `contacts.json`. Set `JSON_DATA_DIR` to choose the directory used for these files. If unset, the JSON storage implementation uses its configured default directory.
- **MongoDB:** Stores applications and contacts in separate collections and uses a counter collection to generate numeric record IDs. Configure the connection with `MONGODB_URI` and `MONGODB_DB`.

Select the storage implementation with `STORAGE_TYPE=json` or `STORAGE_TYPE=mongodb`. JSON storage is the default when no storage type is configured.

For backend tests, `TEST_STORAGE_TYPE` selects the implementation to test and takes precedence over `STORAGE_TYPE`. JSON tests use temporary data files so they do not modify your regular application data.

MongoDB tests must use a dedicated test database, such as `job_tracker_test`. Configure `MONGODB_URI` to point to a local or otherwise isolated test instance. Never run the test suite against a database containing production or personal data.

Back up JSON files or your MongoDB database before manually changing or replacing stored data.

### Applications

Application records are stored in the `applications` collection when using MongoDB, or in `jobs.json` when using JSON storage. The JSON file contains an object with an `applications` array.

A record can contain the following fields:

| Field | Description |
| --- | --- |
| `id` | Numeric record identifier. |
| `company` | Company or organization. |
| `position` | Job title. |
| `location` | Job location. |
| `type` | Application type, such as `Empresa` or `Investigación`. |
| `appliedAt` | Application date in `YYYY-MM-DD` format. |
| `status` | `pending`, `interview`, `offer`, `rejected`, or `suspended`. |
| `field` | Professional field or area. |
| `duration` | Employment duration or contract type. |
| `document` | Optional document-related information. |

Example `jobs.json`:

```json
{
  "applications": [
    {
      "id": 1,
      "appliedAt": "2026-10-01",
      "company": "Example Company",
      "location": "Remote",
      "position": "Software Engineer",
      "duration": "Permanent",
      "type": "Empresa",
      "field": "Software Engineering",
      "status": "pending",
      "document": ""
    }
  ]
}
```

When using JSON storage, use a top-level `applications` array. Each entry should have a unique numeric `id`, an `appliedAt` date in `YYYY-MM-DD` format, and a valid status. Other fields can be empty strings when they do not apply.

When creating an application through the frontend, the current local date is assigned automatically. The API itself still requires `appliedAt` in the creation request. Omit `id` when creating records through the API; the server generates it.

### Contacts

Contact records are stored in the `contacts` collection when using MongoDB, or in `contacts.json` when using JSON storage. The JSON file contains an object with a `contacts` array.

A record can contain the following fields:

| Field | Description |
| --- | --- |
| `id` | Numeric record identifier. |
| `contact` | Contact person's name. |
| `center` | Company or center name. |
| `contactedAt` | Date of first contact in `YYYY-MM-DD` format. |
| `status` | `pending`, `replied`, `rejected`, or `suspended`. |
| `notes` | Free-text notes or follow-up comments. |

Example `contacts.json`:

```json
{
  "contacts": [
    {
      "id": 1,
      "contact": "Ana García",
      "center": "Acme Labs",
      "contactedAt": "2026-10-02",
      "status": "pending",
      "notes": "Asked for a meeting next week."
    }
  ]
}
```

When creating a contact through the frontend, the current local date is assigned automatically. The API itself still requires `contactedAt` in the creation request.

Omit `id` when creating records through the API; the server generates it. The `notes` field may be an empty string.

## API

The API runs at [http://localhost:3001](http://localhost:3001). The frontend accesses it through the Vite proxy at `/api`.

Invalid input, including dates that do not exist (such as `2026-02-31`), returns `400`. Unknown record IDs return `404`. API errors are returned as JSON objects containing an `error` field.

### Applications

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/applications` | Return `{ "applications": [...] }`. |
| `POST` | `/api/applications` | Create an application. The server assigns its ID. Requires `appliedAt` in `YYYY-MM-DD` format; status defaults to `pending`. Unknown fields are ignored. |
| `PATCH` | `/api/applications/:id` | Update an application's status. Accepted values: `pending`, `interview`, `offer`, and `rejected`. |
| `GET` | `/api/applications/old` | Return pending applications older than 30 days. |
| `PATCH` | `/api/applications/:id/suspend` | Suspend an eligible pending application older than 30 days. |

### Contacts

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/contacts` | Return `{ "contacts": [...] }`. |
| `POST` | `/api/contacts` | Create a contact. The server assigns its ID. Requires `contact`, `center`, `contactedAt`, and a valid status: `pending`, `replied`, or `rejected`. |
| `PATCH` | `/api/contacts/:id` | Update a contact's status and/or notes. |
| `GET` | `/api/contacts/old` | Return pending contacts older than 30 days. |
| `PATCH` | `/api/contacts/:id/suspend` | Suspend an eligible pending contact older than 30 days. |

Example contact update request:

```json
{
  "status": "replied",
  "notes": "Followed up"
}
```

The API allows browser requests from `http://localhost:3000` and `http://localhost:5173`. Requests from other origins receive `403`.

Writes are serialized and atomic in JSON storage. MongoDB storage uses database operations to persist records.

## Project structure

```text
.
├── .github/workflows/ci.yml       CI: installs dependencies, runs lint, tests and build
├── .gitignore                     Ignores dependencies, build output, logs, editor files and local data files
├── .nvmrc                         Node.js version used locally and in CI
├── package.json                   Root scripts (dev, lint, test, build, install:all)
├── package-lock.json              Locked versions of root dependencies
├── README.md                      This document
│
├── client/                        React frontend (Vite)
│   ├── index.html                 HTML entry page with the root element
│   ├── vite.config.js              Vite config: React plugin, /api proxy and Vitest settings
│   ├── eslint.config.js            ESLint rules for the frontend
│   ├── package.json                Frontend scripts and dependencies
│   ├── package-lock.json           Locked versions of frontend dependencies
│   ├── public/
│   │   └── favicon.svg             Browser tab icon
│   └── src/
│       ├── main.jsx                Mounts <App /> and loads global styles
│       ├── App.jsx                 Switches between applications and contacts views
│       ├── api.js                  fetch wrapper for /api that sends JSON and handles errors
│       ├── constants.js            Page size, filter values and status labels
│       ├── utils.js                Helpers to filter, sort, count and replace records
│       ├── index.css               Base page styles
│       ├── App.css                 Layout and component styles
│       ├── hooks/
│       │   ├── useCollection.js    Loads a collection and its stale list from the API; create, update and suspend
│       │   └── usePagination.js    Splits a list into pages and keeps the current page in range
│       ├── components/
│       │   ├── Header.jsx          Title, button to switch view and "new" button for the current view
│       │   ├── Applications.jsx    Applications view: stale alert, form, stats, search, type filter, table and pagination
│       │   ├── ApplicationsTable.jsx  Applications table with a status selector per row
│       │   ├── Contacts.jsx        Contacts view: stale alert, stats, form, search, table, pagination and note dialog
│       │   ├── ContactsTable.jsx   Contacts table with a status selector and note button per row
│       │   ├── RecordForm.jsx      Generic create form built from a list of fields
│       │   ├── NoteButton.jsx      Opens the note of a contact; the icon shows whether it has one
│       │   ├── NoteForm.jsx        Dialog to view and edit a contact's note
│       │   ├── StaleItemsAlert.jsx Warning for pending records older than 30 days, with a list to suspend them
│       │   ├── StatCards.jsx       Clickable counters per status that filter the table
│       │   ├── StatusSelect.jsx    Status dropdown; "suspended" only appears for suspended records
│       │   ├── Toolbar.jsx         Search box plus optional extra filters
│       │   ├── Pagination.jsx      Previous/next buttons and "page X of Y"
│       │   └── EmptyState.jsx      Message shown when no records match
│       └── test/
│           ├── setup.js            Vitest setup
│           ├── mockApi.js          Mock API responses for frontend tests
│           ├── utils.test.js       Tests for utils.js
│           ├── App.test.jsx        Tests view switching and forms
│           ├── useCollection.test.js Tests loading, updates and error handling
│           ├── Applications.test.jsx Tests for the applications view
│           └── Contacts.test.jsx   Tests for the contacts view
│
└── server/                         Express API
    ├── server.js                   Starts the API (port 3001 by default)
    ├── app.js                      createApp(): CORS, validation, routes and error handling; accepts injected storage
    ├── db.js                       Connects to MongoDB and exposes database access and connection cleanup
    ├── storage/
    │   ├── index.js                Selects the JSON or MongoDB storage implementation
    │   ├── json.js                 JSON-file storage with atomic, serialized writes
    │   └── mongodb.js              MongoDB storage implementation with generated numeric IDs
    ├── eslint.config.js            ESLint rules for the API
    ├── package.json                API scripts and dependencies
    ├── package-lock.json           Locked versions of API dependencies
    └── test/
        └── app.test.js             API tests for the selected storage implementation
```

The frontend coverage reports are generated in `client/coverage/`. Backend coverage reports are generated by c8. Coverage directories are generated locally and should not be committed to Git.
