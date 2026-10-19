# Job Tracker

A small full-stack application for tracking job applications and professional contacts. The React interface lets you review and update application and contact statuses, while an Express API stores the records in local JSON files.

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
- Persist all data in local JSON files without requiring a database.

## Tech stack

- **Frontend:** React 19, Vite 8
- **Backend:** Node.js, Express 5
- **Testing:** Node.js test runner, Vitest, React Testing Library
- **Code quality:** ESLint
- **Coverage:** c8 for the backend and Vitest's V8 coverage provider for the frontend
- **Storage:** Local JSON files

## Prerequisites

- Node.js version specified in `.nvmrc`.
- npm (included with Node.js).

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
| `npm test` | Run backend and frontend tests with coverage enabled. |
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
- Runs backend tests using Node.js's built-in test runner and c8 coverage.
- Runs frontend tests using Vitest and its V8 coverage provider.
- Uploads coverage reports as a downloadable GitHub Actions artifact.
- Builds the frontend for production.

Coverage artifacts are retained for 14 days. They can be downloaded from the **Artifacts** section of a completed workflow run.

The workflow uses read-only repository permissions and cancels superseded runs for the same branch or pull request.

The CI currently reports coverage but does not enforce minimum coverage thresholds.

## Data storage

The application uses two JSON collections:

- `client/src/data/jobs.json` for job applications.
- `client/src/data/contacts.json` for professional contacts and notes.

Create these files locally before starting the API if they do not already exist. The server reads and writes the files directly.

The data files are intentionally excluded from Git to avoid committing personal job-search information. Back them up before manually changing or replacing their contents.

### Applications

Application records are stored in `jobs.json` as an object containing an `applications` array.

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

Use a top-level `applications` array. Each entry should have a unique numeric `id`, an `appliedAt` date in `YYYY-MM-DD` format, and a valid status. Other fields can be empty strings when they do not apply.

When creating an application through the frontend, the current local date is assigned automatically. The API itself still requires `appliedAt` in the creation request. Omit `id` when creating records through the API; the server generates it.

### Contacts

Contact records are stored in `contacts.json` as an object containing a `contacts` array.

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

Writes are serialized and atomic to prevent concurrent requests from overwriting each other's changes.

## Project structure

```text
.
├── .github/workflows/ci.yml        CI: installs dependencies, then runs lint, tests and build on every pull request and push to master
├── .gitignore                      Ignores dependencies, build output, logs, editor files and the local data files
├── .nvmrc                          Node.js version used locally and in CI
├── package.json                    Root scripts (dev, lint, test, build, install:all) that run the client and the server together
├── package-lock.json               Locked versions of the root dependencies (concurrently)
├── README.md                       This document
│
├── client/                         React frontend (Vite)
│   ├── index.html                  HTML entry page with the root element
│   ├── vite.config.js              Vite config: React plugin, /api proxy to port 3001 and Vitest (jsdom) settings
│   ├── eslint.config.js            ESLint rules for the frontend
│   ├── package.json                Frontend scripts and dependencies
│   ├── package-lock.json           Locked versions of the frontend dependencies
│   ├── public/
│   │   └── favicon.svg             Browser tab icon
│   └── src/
│       ├── main.jsx                Mounts <App /> and loads the global styles
│       ├── App.jsx                 Switches between the applications and contacts views and opens/closes the form
│       ├── api.js                  apiRequest(): fetch wrapper for /api that sends JSON and throws on error responses
│       ├── constants.js            Page size, the "all statuses" filter value and the status labels
│       ├── utils.js                Pure helpers to filter by status or text, sort by date, count and replace by id
│       ├── index.css               Base page styles (font, background)
│       ├── App.css                 Styles for the layout and all components
│       ├── data/                   Local data, not tracked by Git (see "Data format")
│       │   ├── jobs.json           Applications
│       │   └── contacts.json       Contacts and their notes
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
│           ├── setup.js            Vitest setup: cleans up the DOM and mocks after each test
│           ├── mockApi.js          mockApi(): replaces fetch with fake responses per "METHOD /api/path"
│           ├── utils.test.js       Tests for utils.js
│           ├── App.test.jsx        Tests view switching and the form of each view
│           ├── useCollection.test.js  Tests loading, updates, stale reloads and error handling
│           ├── Applications.test.jsx  Tests for the applications view
│           └── Contacts.test.jsx   Tests for the contacts view
│
└── server/                         Express API
    ├── server.js                   Starts the API on port 3001
    ├── app.js                      createApp(): CORS, validation, routes, error handling and serialized, atomic JSON storage
    ├── eslint.config.js            ESLint rules for the API
    ├── package.json                API scripts and dependencies
    ├── package-lock.json           Locked versions of the API dependencies
    └── test/
        └── app.test.js             API tests against temporary data files
```

The frontend coverage reports are generated in `client/coverage/`. Both coverage directories are generated locally and should not be committed to Git.
