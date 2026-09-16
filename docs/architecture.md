# Architecture and editing guide

The app uses a single Node.js process for its HTTP APIs and frontend delivery. Vite supplies hot reload during development and produces static assets for production. MySQL and PostgreSQL execute practice queries in isolated workspaces. PostgreSQL also stores private account data.

## Folder ownership

| Location                          | What belongs here                                                             |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `frontend/src/main.jsx`           | Browser entry point: mounts the app                                           |
| `frontend/src/App.jsx`            | Application state, navigation, progress coordination, practice layout         |
| `frontend/src/pages/`             | Dashboard, question library, leaderboard, and account pages                   |
| `frontend/src/components/`        | Shared controls, header, account menu, and dialogs                            |
| `frontend/src/features/practice/` | SQL editor, question descriptions, test results, submissions, practice drawer |
| `frontend/src/hooks/`             | Reusable React hooks                                                          |
| `frontend/src/lib/`               | HTTP client, browser preferences, and display helpers                         |
| `frontend/src/stores/`            | Guest IndexedDB and signed-in progress synchronization                        |
| `frontend/src/styles/`            | Shared and page styles                                                        |
| `frontend/public/`                | Public images and favicon                                                     |
| `frontend/vite.config.js`         | Frontend build configuration                                                  |
| `backend/index.mjs`               | Server startup, request dispatch, frontend serving, and shutdown              |
| `backend/api/`                    | Account, leaderboard, and query HTTP handlers                                 |
| `backend/auth/`                   | Google OAuth and session handling                                             |
| `backend/config/`                 | Environment loading and deployment access settings                            |
| `backend/http/`                   | Request URL parsing and response security headers                             |
| `backend/sql/`                    | Query workers, time limits, SQL validation, result comparison                 |
| `backend/problems/`               | Catalog loading, expected-answer functions, generated edge cases              |
| `backend/services/`               | Leaderboard maintenance logic                                                 |
| `database/connections/`           | Database configuration, local engine lifecycle, isolated SQL workspaces       |
| `database/repositories/`          | PostgreSQL queries for users, sessions, progress, and verified solves         |
| `database/schema/accounts.sql`    | Existing idempotent account-schema bootstrap                                  |
| `database/questions/`             | One JSON record per question and an ordered manifest                          |
| `shared/`                         | Framework-independent validation, navigation, scoring, and progress rules     |
| `tests/`                          | Regression tests, integration tests, and reference SQL used by tests          |
| `scripts/`                        | Commands for tests, Docker credentials, and leaderboard maintenance           |

Frontend code must not import backend or database modules. Both frontend and backend can import `shared/`. Question data, private fixtures, and reference solutions are read only by the backend; `/api/problems` removes private fields before returning practice data.

## Request flow

1. The browser loads the UI and requests questions, engine availability, and session information.
2. The backend validates API requests and, when signed in, verifies the account and CSRF token.
3. A query runs in a child worker. The worker creates isolated tables using the chosen MySQL or PostgreSQL engine and compares its output against expected answers.
4. Guest progress is saved in IndexedDB. Signed-in progress is saved through the account repository in PostgreSQL.

`backend/sql/reference-database.mjs` retains the SQLite adapter used by reference-query regression tests. It is intentional: MySQL and PostgreSQL remain the user-facing engines.

## Editing questions

Question content is file-backed in this checkout. This reorganization does not introduce an admin interface or a PostgreSQL question catalog.

Each record has a stable filename such as `database/questions/qr1459-rectangles-area.json`. The file contains the statement, schema, starter query, examples, practice cases, submission cases, and any stored reference SQL. Never rename an existing question's `slug` or change its `number` merely to reorder the list: links, saved progress, and verified solves depend on these identifiers.

`database/questions/manifest.json` records the original, playlist, and additional groups in their existing practice order. `backend/problems/load-data.mjs` reads those files. Group adapters attach expected-answer functions and the same deterministic edge cases used before the reorganization.

To update an existing question:

1. Locate its `qr<number>-<slug>.json` file and edit the relevant content or fixtures.
2. If the expected result rules change, update its checker under `backend/problems/` and review the corresponding edge cases.
3. Run `npm test`. Check both SQL engines and ensure custom inputs still receive correct expected answers.

To add a new question, add a JSON record, its manifest entry, an independent expected-answer checker, and suitable edge cases. Add reference SQL and regression coverage following the existing tests. A source URL alone is not sufficient to create a verified practice problem.

## Schema and runtime data

`accounts.sql` is loaded by the account repository at startup. The repository validates the schema name before substituting its quoted value for `{{schema}}`. The existing `CREATE IF NOT EXISTS` and `ALTER ... IF NOT EXISTS` behavior is preserved, including private schema permissions and support for isolated test schemas. This file is bootstrap SQL, not a versioned migration system.

Runtime storage remains outside the source folders:

- `.data/engines/`: existing local database files and credentials.
- `backups/`: database backups; never deleted as source cleanup.
- Docker named volumes: persistent database contents, credentials, and Caddy certificates.
- Browser IndexedDB/localStorage: guest progress and personal UI preferences.

The root `.env` remains the configuration source. Rebuild the Docker image after changing deployment values. No database reset or progress migration is required for this folder reorganization.

## Formatting and checks

Run `npm run format` after editing code. Prettier formats JavaScript, JSX, CSS, and documentation using the root configuration. Question JSON uses two-space indentation and is excluded from automatic formatting to avoid noisy fixture changes.

Run `npm run build` and `npm test` before deploying. The test suite exercises authentication, progress isolation, leaderboard scoring, question validation, SQL comparison, native database execution, and HTTP behavior.
