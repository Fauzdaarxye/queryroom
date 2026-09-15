# Queryroom

A personal SQL practice app with **79 questions and 1,032 test cases**, supporting MySQL and PostgreSQL.

Each question has a stable Queryroom ID using `qr` plus its LeetCode number, such as `qr1459` for Rectangles Area. IDs appear in the question header and practice list, work in search, and can open a question directly with `?problem=qr1459`. Existing saved links and browser progress continue to work.

Every question includes eight additional, selectable edge cases covering its specific rules: ties, exact thresholds, missing matches, duplicate records, calendar boundaries, and larger inputs. Submit runs the full suite. Expected answers are calculated by independent JavaScript checkers and verified against SQL solutions on both database engines. These are local practice tests, not LeetCode’s private tests; passing them improves confidence but cannot prove correctness for every possible input.

## Run with Docker

From the project folder on EC2 or another Docker host:

```sh
docker compose up --build -d
```

Open **http://YOUR_EC2_PUBLIC_IP** (or **http://localhost** locally). The workspace opens directly without signing in. Anyone who can reach the website can practise, with progress kept separately in their own browser. Caddy serves HTTP on port 80 by default; configure your domain below for automatic HTTPS. Use `sudo docker compose` if required on Ubuntu.

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

## Personal progress

Solved status, the latest 100 submissions per question, SQL drafts, notes, and bookmarks are stored in **IndexedDB in the visitor’s browser**. Preferences and custom test cases also stay in browser storage. The server receives SQL to execute and returns test results, but does not read or save personal progress.

Progress survives refreshes, normal browser restarts, and app container rebuilds. It belongs to one browser profile and website address (scheme, host, and port); another browser, device, or address starts with separate progress. People sharing the same browser profile and address share that profile’s progress. Clearing site data removes it, and private browsing removes it when the private session ends. Keep using the same public domain/address for consistent access to your saved work.

When upgrading, existing drafts and notes backed up in that browser are recovered. Old shared PostgreSQL history and `.data/progress.json` are left untouched but are no longer loaded or updated. They cannot be assigned to individual visitors automatically. No database migration is needed. Update the project on EC2, run `sudo docker compose up --build -d`, and refresh the browser.

## Development

Local development requires Node.js 24+, MySQL, and PostgreSQL binaries. The local server uses private database instances to execute SQL. Progress stays in the browser in development too.

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
