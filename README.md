# Job Tracker

A small full-stack application for tracking job applications and professional contacts. The React interface lets you review and update application and contact statuses, while an Express API stores the records in local JSON files.

## Features

- Track job applications and professional contacts in the same dashboard.
- Add applications with a company, position, location, type, application date, and status (the date is required).
- Search applications by company, position, location, type, or field.
- Filter by application type or status and view summary counts.
- Browse results in pages of 10, sorted by application date (newest first).
- Review pending applications that have been open for more than 30 days and suspend them.
- Manage contacts with a name, center/company, date of contact, status, and personal notes.
- Search, filter, and paginate contacts, including notes-based searches.
- Add and edit notes for each contact through a dedicated modal window.
- Review pending contacts older than 30 days and suspend them.
- Persist all data in local JSON files without requiring a database.

## Tech stack

- **Frontend:** React 19, Vite 8
- **Backend:** Node.js, Express 5
- **Storage:** `client/src/data/jobs.json` and `client/src/data/contacts.json`

## Prerequisites

- Node.js 20.19+ or 22.12+
- npm

## Getting started

Install dependencies for the root, the API, and the frontend:

```sh
npm run install:all
```

Start the API and the frontend together from the project root:

```sh
npm run dev
```

The API listens at `http://localhost:3001`. Open the local URL printed by Vite (by default, `http://localhost:5173`); it proxies `/api` requests to the API.

You can also run each part separately with `npm start` (or `npm run dev`) in `server` and `npm run dev` in `client`.

## Available scripts

From the project root:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API and the Vite development server. |
| `npm run lint` | Run ESLint on the API and the frontend. |
| `npm test` | Run the API tests (Node test runner) and the frontend tests (Vitest + React Testing Library). |
| `npm run build` | Build the frontend for production in `client/dist`. |

From `client`: `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`, `npm test`.

From `server`: `npm start`, `npm run dev` (restarts on changes), `npm run lint`, `npm test`.

CI runs lint, tests, and the build on every pull request.

## Data format

The application stores two JSON collections:

- `client/src/data/jobs.json` for job applications.
- `client/src/data/contacts.json` for contacts and notes.

### Applications

Application records are stored in `client/src/data/jobs.json` as an object with an `applications` array. A record can contain:

| Field | Description |
| --- | --- |
| `id` | Numeric record identifier. |
| `company` | Company or organization. |
| `position` | Job title. |
| `location` | Job location. |
| `type` | Application type, such as `Empresa` or `Investigación`. |
| `appliedAt` | Application date in `YYYY-MM-DD` format. |
| `status` | `pending`, `interview`, `offer`, `rejected`, or `suspended`. |
| `field`, `duration`, `document` | Optional additional details. |

Create this file locally at `client/src/data/jobs.json` before starting the API. The server reads and writes it directly, and it is intentionally ignored by Git so personal application data is not committed. Back it up before manually changing or replacing its contents.

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

Use a top-level `applications` array. Each entry should have a unique numeric `id`, an `appliedAt` date in `YYYY-MM-DD` format, and a valid `status`. The other fields shown above can be empty strings when they do not apply. When creating an application through the API, omit `id`; the server generates it.

### Contacts

Contact records are stored in `client/src/data/contacts.json` as an object with a `contacts` array. A record can contain:

| Field | Description |
| --- | --- |
| `id` | Numeric record identifier. |
| `contact` | Contact person name. |
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

When creating or updating a contact through the API, omit `id`; the server generates it. The `notes` field may be empty.

## API

The API runs at `http://localhost:3001`; the frontend calls it through the Vite proxy at `/api`. Invalid input (including dates that do not exist, such as `2026-02-31`) returns `400`, unknown IDs return `404`, and errors are returned as `{ "error": "..." }`.

### Applications

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/applications` | Return `{ "applications": [...] }`. |
| `POST` | `/api/applications` | Create an application. The server assigns its ID. Requires `appliedAt` (`YYYY-MM-DD`); `status` defaults to `pending`. Unknown fields are ignored. |
| `PATCH` | `/api/applications/:id` | Update a status (`pending`, `interview`, `offer`, or `rejected`). |
| `GET` | `/api/applications/old` | Return pending applications older than 30 days. |
| `PATCH` | `/api/applications/:id/suspend` | Suspend an eligible pending application older than 30 days. |

### Contacts

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/contacts` | Return `{ "contacts": [...] }`. |
| `POST` | `/api/contacts` | Create a contact. The server assigns its ID. Requires `contact`, `center`, `contactedAt`, and a valid `status` (`pending`, `replied`, or `rejected`). |
| `PATCH` | `/api/contacts/:id` | Update a contact status and/or notes. Accepts a JSON body such as `{ "status": "replied", "notes": "Followed up" }`. |
| `GET` | `/api/contacts/old` | Return pending contacts older than 30 days. |
| `PATCH` | `/api/contacts/:id/suspend` | Suspend an eligible pending contact older than 30 days. |

The API allows browser requests from `http://localhost:3000` and `http://localhost:5173`; other origins get `403`. Writes are serialized and atomic, so concurrent requests do not overwrite each other.

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
    ├── server.js                   Starts the API (on port 3001 by default).
    ├── app.js                      createApp(): CORS, validation, routes, error handling and serialized, atomic MongoDB storage
    ├── db.js                       Connects, gets and closes DB conection
    ├── eslint.config.js            ESLint rules for the API
    ├── package.json                API scripts and dependencies
    ├── package-lock.json           Locked versions of the API dependencies
    └── test/
        └── app.test.js             API tests against temporary data files
```
