# Queryroom

A SQL practice app with **64 questions and 310 test cases**, supporting MySQL and PostgreSQL. The dashboard shows progress, a recommended or unfinished question, difficulty collections, and recent activity. The separate question library offers search, difficulty and status filters, bookmarks, sorting, and pagination. Accepted submissions also mark questions solved.

## Run with Docker

From the project folder on EC2 or another Docker host:

```sh
docker compose up --build -d
```

Open **http://YOUR_EC2_PUBLIC_IP** (or **http://localhost** locally). The welcome page offers Google sign-in or guest access. Choose Continue as guest to open the dashboard and practise without signing in. Continue with Google saves progress to an account across browsers and devices; guest progress stays in the browser. Caddy serves HTTP on port 80 by default; configure your domain below for automatic HTTPS. Use `sudo docker compose` if required on Ubuntu.

One `Dockerfile` builds the app. One `compose.yaml` starts Caddy 2, the app, official MySQL 8.4 and PostgreSQL 17 images, and automatic credential setup. Caddy forwards requests directly to `app:4317` over the Compose network. The app and database ports stay private. The setup service exiting successfully is normal.

Suggested EC2 size: **Ubuntu 24.04 LTS x86_64, t3.medium, 4 GiB RAM, 30 GiB gp3 storage**.

## Configuration

`.env` contains `CADDY_SITE` (default `:80` for HTTP) and optional first-run values for `MYSQL_PASSWORD` and `POSTGRES_PASSWORD`. Existing passwords are preserved. Without `.env`, Compose generates passwords automatically.

After initialization, the credentials volume keeps the passwords across restarts; editing `.env` does not rotate initialized database credentials. `.env` is private and ignored by Git. `.env.example` is a safe template to commit.

## HTTPS with Caddy on EC2

1. Point your domain's DNS A record to the EC2 public IPv4 address (prefer an Elastic IP). If you have an AAAA record, it must point to reachable IPv6 on this instance; otherwise remove it.
2. Set `CADDY_SITE=your-real-domain.com` in `.env`, without a scheme or path. Keep `CADDY_SITE=:80` if using HTTP by IP without a domain.
3. Allow inbound **TCP 80 and 443** in the EC2 security group and Ubuntu firewall, if enabled. Allow **UDP 443** for HTTP/3. For public domain certificates, ports 80/443 must be reachable from the internet; allow outbound DNS and HTTPS too.
4. Run `sudo docker compose up --build -d` and open `https://your-real-domain.com`.

Caddy obtains and renews certificates automatically for the configured domain and redirects HTTP to HTTPS. Certificate state and configuration persist in `caddy_data` and `caddy_config`. `Caddyfile` is the mounted proxy configuration. For configuration edits, run `sudo docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`; after changing `.env`, run `sudo docker compose up -d` to recreate Caddy with the new domain.

Ports 80 and 443 must be free on the host. When upgrading an existing Queryroom deployment that used port 80 directly, run `sudo docker compose down` before `sudo docker compose up --build -d` to avoid a port conflict while Caddy takes over. Do not add `-v`; named volumes are preserved. Stop any separate Caddy/Nginx/Apache service already using these ports before starting this stack.

Changing from HTTP to HTTPS, or from an IP to a domain, creates a different browser storage location. Progress at the old address does not automatically transfer to the new address.

## Manage the app

```sh
docker compose ps -a
docker compose logs --tail=100 caddy app mysql postgres
docker compose down
docker compose up -d
```

Database contents, passwords, and Caddy certificates persist in named volumes. Keep the project name `queryroom`. Do not use `down -v` when you want to retain your databases and credentials.

## Google sign-in

The welcome page (`/login`, also the default home page) has two choices: **Continue with Google** and **Continue as guest**. Guests open `/dashboard` and can run or submit any question. Google handles both sign-in and account creation; there is no separate password account.

After their first Google sign-in, users complete `/onboarding` with a unique username, full name, age, and profession. Usernames are case-insensitive and database-enforced, with 3–24 letters, digits, or underscores, starting with a letter. Returning users go directly to the dashboard. Existing Google users without a profile are asked to complete it; their saved progress is preserved.

The **Dashboard** (`/dashboard`) is a compact overview of solved questions, work in progress, bookmarks, and saved submissions. Resume an unfinished question or open a difficulty collection. Recent activity shows the latest three attempts.

The **Questions** page (`/questions`) shows 8 questions per page by default, with optional 16- and 24-row views. Search and filters apply to the full collection before pagination. Filter by Easy / Medium / Hard, To do / In progress / Solved, or bookmarks, and sort by recommendation, number, title, or difficulty. Filter and page choices are kept in the URL and restored when returning from a question. Questions can still be marked solved manually.

The **Leaderboard** (`/leaderboard`) ranks all users who have completed registration, including users with zero points. Easy / Medium / Hard questions earn **10 / 25 / 50** points respectively. A question earns points once, after a signed-in submission passes every test. Repeats across either SQL engine do not add points; manual progress marks and failed attempts do not change earned points. Equal scores share a global rank (1, 2, 2, 4). Search by username, browse 10 learners per page, and see your own rank even while viewing other pages. Rankings refresh every 30 seconds and when the window regains focus.

Only usernames, ranks, points, and verified solve counts are public. Names, emails, age, profession, drafts, and submission SQL remain private. Users appear on the board after choosing their username during onboarding. Earned points live in the private `queryroom_accounts.verified_solves` table, independently of editable practice history.

For an existing installation, run `npm run leaderboard:backfill` once after updating. This re-executes older accepted SQL in the normal sandbox against every current test before awarding points. It is safe to rerun; duplicates cannot earn more points. Imported browser history alone never grants points. Any older solution that cannot be verified (including legacy SQLite history) can be submitted again with MySQL or PostgreSQL.

The **Profile** page (`/profile`) shows solved questions, difficulty totals, and the latest 50 saved submissions. Users can open a question again or edit their four profile fields. Profiles and personal details are private to their account.

Guest practice works even when OAuth is not configured. To enable **Continue with Google**, create a **Web application** OAuth client in Google Auth Platform. Configure these redirect URIs exactly:

```text
https://queryroom.duckdns.org/api/auth/google/callback
http://localhost:4317/api/auth/google/callback
```

The corresponding JavaScript origins are `https://queryroom.duckdns.org` and `http://localhost:4317`. Choose an External audience, add test users while testing, and request only `openid`, email, and profile. Publish the OAuth app when you are ready to admit other Google accounts.

Create a private `.env` using `.env.example` as a guide. Keep existing database/password settings if the file already exists:

**Put the actual secret in `.env`, not `.env.example`.** The example file is only a template and is not loaded by the server. Restart `npm run dev` after saving `.env`; startup reports whether Google sign-in is configured, without displaying credentials.

```dotenv
CADDY_SITE=queryroom.duckdns.org
GOOGLE_CLIENT_ID=992227236229-ec3g0vp18kuajbjv6dumlilld5ljtcpq.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret-from-google
```

`.env` is ignored by Git and excluded from Docker builds. Node loads it for local development; Docker Compose passes OAuth settings only to the server. `GOOGLE_CLIENT_SECRET_FILE` is also supported when supplying a mounted secret directly to the server. Never place a client secret in a `VITE_` variable or frontend code.

Local development defaults to the localhost callback on its `PORT` (4317 by default). Compose defaults to the production DuckDNS callback above. For another deployment address, set `GOOGLE_REDIRECT_URI` to its exact HTTPS callback and register it with Google. Restart `npm run dev` after changing local settings; on the server, run `docker compose up --build -d` after changing deployment settings or code.

Authentication uses a one-time state bound to an HttpOnly browser cookie, PKCE, and a nonce. Google's signed identity token is checked for issuer, audience, expiry, signature, nonce, and verified email. Users are identified by their stable Google subject ID. Login sessions use random, server-side tokens with a 30-day expiry; HTTPS cookies are Secure and host-only. Account writes require a CSRF token, the expected account ID, and the configured origin. Signing out revokes that browser's session.

## Personal progress

Guests keep solved status, the latest 100 submissions per question, drafts, notes, and bookmarks in **IndexedDB in their own browser**. Guest practice never requires Google sign-in. Clearing browser site data removes guest progress, and private browsing keeps it only for that private session.

Signed-in users save the same progress in the private `queryroom_accounts` schema in PostgreSQL. It persists in the existing `postgres_data` Docker volume (or the private local PostgreSQL data directory). Keep that volume when rebuilding or upgrading. Practice SQL users have no access to this schema. Queries never receive Google credentials or login-session tokens.

On first sign-in, people with existing browser progress can choose **Import my progress** or **Keep separate**. Import preserves existing account drafts and notes, combines solved status/bookmarks, and deduplicates submission history. The browser copy remains available to guests. Import is recorded once per account, so it cannot repeatedly undo later manual status changes.

Account drafts keep a temporary recovery copy keyed to that account if syncing is interrupted. They are retried when that account reloads; they are never imported into a different account or guest progress. Custom test cases, theme, practice timer, and display preferences remain local to the browser. Account progress refreshes when you return to the dashboard, question library, or profile.

Old shared `queryroom_state` records and `.data/progress.json` are left untouched and remain inaccessible through `/api/state`. They are not assigned to a Google user automatically.

## Request and query limits

The server runs at most four SQL requests concurrently per app process. Extra requests receive HTTP 429 with `Retry-After: 1`; the slot is released after success or failure. Each query still runs with read-only database credentials and a three-second statement timeout. Results are capped at 5,000 rows and 1 MB of row data per test, with a 4 MB cumulative result budget per submission. Submissions stop after exceeding an output limit.

Malformed request URLs return HTTP 400 without interrupting the server. Pages and API responses block framing and plugins, prevent MIME sniffing, and limit cross-origin referrer information. The account dropdown contains account details and Sign out; the primary navigation remains in the header.

## Development

Local development requires Node.js 24+, MySQL, and PostgreSQL binaries. The local server uses private database instances to execute SQL and store signed-in account progress. Guest progress stays in the browser; Google-account progress uses the private local PostgreSQL instance.

On macOS, install the databases with `brew install mysql@8.4 postgresql@18`. Queryroom detects these Homebrew installations directly, even when the global `mysqld` command points to MariaDB. MariaDB is not supported. Local instances use `.data/engines` and do not modify Homebrew service databases. In VS Code, open this project folder and run the commands below in its integrated terminal.

```sh
npm ci
npm run dev
```

For validation and a production build:

```sh
npm test
npm run build
npm start
```

Local mode opens at **http://localhost:4317**. Docker does not require these tools installed on the host.

Application code is in `src/`, `server/`, and `shared/`. Questions and fixtures are in `server/problems/`. `scripts/` contains Docker initialization and test utilities.

## Question sources

Questions link to their original [LeetCode](https://leetcode.com/) pages. Public statement references: [doocs/leetcode](https://github.com/doocs/leetcode). The imported collection includes the [SQL Hard playlist](https://www.youtube.com/playlist?list=PLtfxzVLWb-B9M7Rx5BrZwZqSBP2_IzRMA). Extra practice tests are local fixtures, not LeetCode's private tests.

Docker configuration and app tests are checked locally. The image build and EC2 startup have not been run on this preparation machine because Docker Engine is unavailable.
