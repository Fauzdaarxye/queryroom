# Architecture and editing guide

The app uses a single Node.js process for its HTTP APIs and frontend delivery. Next.js supplies the frontend routes, development hot reload, and production build. MySQL and PostgreSQL execute practice queries in isolated workspaces. PostgreSQL also stores private account data.

## Folder ownership

| Location                          | What belongs here                                                             |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `frontend/app/`                   | Next.js route and layout entry points                                         |
| `frontend/src/App.tsx`            | Application state, navigation, progress coordination, practice layout         |
| `frontend/src/screens/`           | Dashboard, question library, leaderboard, and account pages                   |
| `frontend/src/components/`        | Shared controls, header, account menu, and dialogs                            |
| `frontend/src/features/practice/` | SQL editor, question descriptions, test results, submissions, practice drawer |
| `frontend/src/hooks/`             | Reusable React hooks                                                          |
| `frontend/src/lib/`               | HTTP client, browser preferences, and display helpers                         |
| `frontend/src/stores/`            | Guest IndexedDB and signed-in progress synchronization                        |
| `frontend/src/styles/`            | Shared and page styles                                                        |
| `frontend/public/`                | Public images and favicon                                                     |
| `frontend/next.config.ts`         | Frontend build configuration                                                  |
| `backend/index.ts`                | Server startup, request dispatch, frontend serving, and shutdown              |
| `backend/api/`                    | Account, leaderboard, and query HTTP handlers                                 |
| `backend/auth/`                   | Google OAuth and session handling                                             |
| `backend/config/`                 | Environment loading and deployment access settings                            |
| `backend/http/`                   | Request URL parsing and response security headers                             |
| `backend/sql/`                    | Query workers, time limits, SQL validation, result comparison                 |
| `backend/catalog/`                | Question imports, sanitized statements, and draft validation                  |
| `backend/services/`               | Leaderboard maintenance logic                                                 |
| `database/connections/`           | Database configuration, local engine lifecycle, isolated SQL workspaces       |
| `database/repositories/`          | PostgreSQL queries for users, sessions, progress, and verified solves         |
| `database/schema/accounts.sql`    | Existing idempotent account-schema bootstrap                                  |
| `database/catalog/`               | Published catalog, immutable revisions, validation, and audits                |
| `database/migrations/`            | PostgreSQL catalog schema setup                                               |
| `database/seeds/`                 | Compressed initial catalog and checksum manifest                              |
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

## Managing questions

PostgreSQL is the source of truth for questions and test cases. The seed archive is an immutable migration snapshot of all 79 existing questions and 1,032 cases; it is read only for first-time catalog initialization and never replaces saved admin edits.

Verified Google accounts listed in `QUERYROOM_ADMIN_EMAILS` can use **Manage questions**. The workflow is: import a URL or paste a statement, edit the draft, review schema and fixtures, supply MySQL and PostgreSQL reference solutions, validate both engines, then publish. URL imports may need pasted content when the source does not provide its public statement. Hidden source-site tests are not imported.

The catalog stores immutable revisions and audit records. Publishing switches the public revision only after validation. Running submissions use a consistent question snapshot. Admin write routes verify role and CSRF protections, and private tests/reference solutions are excluded from the public question response.

Question IDs, URL slugs, and practice order are retained during migration. Do not rename an existing slug to reorder the catalog, because saved progress and links use it.

## Schema and runtime data

`accounts.sql` is loaded by the account repository at startup. The repository validates the schema name before substituting its quoted value for `{{schema}}`. The existing `CREATE IF NOT EXISTS` and `ALTER ... IF NOT EXISTS` behavior is preserved, including private schema permissions and support for isolated test schemas. Account bootstrap is separate from the catalog migration in `database/migrations/001_catalog.sql`. Catalog initialization uses a migration record and an advisory lock to serialize first boot.

Runtime storage remains outside the source folders:

- `.data/engines/`: existing local database files and credentials.
- `backups/`: database backups; never deleted as source cleanup.
- Docker named volumes: persistent database contents, credentials, and Caddy certificates.
- Browser IndexedDB/localStorage: guest progress and personal UI preferences.

The root `.env` remains the configuration source. Rebuild the Docker image after changing deployment values. No database reset is required. On first startup the catalog schema is initialized and seeded alongside existing account data; later restarts preserve edits.

## Formatting and checks

Run `npm run format` after editing code. Prettier formats JavaScript, JSX, CSS, and documentation using the root configuration. The compressed catalog seed is excluded from formatting. Add or edit future questions through the admin workflow.

Run `npm run typecheck`, `npm run build`, and `npm test` before deploying. The test suite exercises authentication, progress isolation, leaderboard scoring, question validation, SQL comparison, native database execution, and HTTP behavior.
