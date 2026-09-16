# Queryroom

A SQL practice workspace with **79 questions and 1,032 test cases**, supporting MySQL and PostgreSQL. It includes a code editor, question library, Google sign-in, progress tracking, profiles, and a leaderboard.

## Start locally

Requires Node.js 24+, MySQL, and PostgreSQL. On macOS, install the database binaries with `brew install mysql@8.4 postgresql@17`.

```sh
npm ci
npm run dev
```

Open [localhost:4317](http://localhost:4317). Local database files remain in `.data/engines/`. Google sign-in is optional; guest practice works without it.

## Start with Docker

Docker Engine and Docker Compose must be installed and running. On macOS, Docker Desktop supplies both.

Keep your existing `.env`. For a new installation, copy `.env.example` to `.env` and set your deployment values, then run:

```sh
docker compose up --build -d
```

Open [localhost](http://localhost) locally, or your configured domain / EC2 public IP. Caddy exposes ports 80 and 443; the app listens on port 4317 inside Docker. Database volumes and credentials survive rebuilds.

See [deployment and operations](docs/deployment.md) for EC2, HTTPS, Google sign-in, and environment settings.

## Project layout

```text
frontend/              React UI, components, styles, and browser storage
backend/               HTTP APIs, authentication, SQL execution, answer checking
database/              Database connections, account repository, schema, question data
shared/                Validation and domain helpers used by UI and server
scripts/               Test runner, Docker credential setup, maintenance commands
tests/                 Automated regression and integration tests
docs/                  Architecture and deployment guides
Dockerfile             Builds the frontend and packages the server
compose.yaml           Runs Caddy, the app, MySQL, and PostgreSQL
Caddyfile              HTTP/HTTPS reverse proxy
```

There is one root `package.json` and lockfile. Run all commands from the project root. The current implementation uses **React/Vite and Node.js JavaScript**; organizing folders does not change the framework.

Read [architecture and editing guide](docs/architecture.md) for file ownership, request flow, and how to update questions safely.

## Development commands

| Command                        | Purpose                                                  |
| ------------------------------ | -------------------------------------------------------- |
| `npm run dev`                  | Start the backend with frontend hot reload               |
| `npm run build`                | Build the frontend into `dist/`                          |
| `npm start`                    | Serve the built frontend and APIs                        |
| `npm test`                     | Run the regression suite with local MySQL and PostgreSQL |
| `npm run format`               | Format source code consistently                          |
| `npm run format:check`         | Check formatting without changing files                  |
| `npm run leaderboard:backfill` | Verify older accepted submissions before awarding points |

## Data and privacy

Guest progress lives in the browser. Signed-in progress lives in PostgreSQL. Question JSON files contain practice content and fixtures, not user accounts or progress. Question IDs, URL slugs, browser storage keys, and Docker volume names are stable.

Keep `.env`, `.data/`, and `backups/` private. The Docker runtime image includes `.env`, so keep the image private too. Do not use `docker compose down -v` when you want to preserve saved database contents.

## Sources

Questions link to [LeetCode](https://leetcode.com/), with public statement references from [doocs/leetcode](https://github.com/doocs/leetcode). Additional practice fixtures are local tests, not LeetCode's private test suite.
