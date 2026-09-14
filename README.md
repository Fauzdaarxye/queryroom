# Queryroom

A personal SQL practice app with **64 questions and 310 test cases**, supporting MySQL and PostgreSQL.

## Run with Docker

From the project folder on EC2 or another Docker host:

```sh
docker compose up --build -d
docker compose logs setup
```

Open **http://YOUR_EC2_PUBLIC_IP** (or **http://localhost** locally). The setup log contains your workspace password. Allow inbound TCP port 80 in your EC2 security group; restrict it to your own IP for this HTTP setup. Use `sudo docker compose` if required on Ubuntu.

One `Dockerfile` builds the app. One `compose.yaml` starts the app, official MySQL 8.4 and PostgreSQL 17 images, and automatic credential setup. The database ports stay private. The setup service exiting successfully is normal.

Suggested EC2 size: **Ubuntu 24.04 LTS x86_64, t3.medium, 4 GiB RAM, 30 GiB gp3 storage**.

## Configuration

`.env` contains `HTTP_PORT` (default `80`) and optional first-run values for `QUERYROOM_ACCESS_PASSWORD`, `MYSQL_PASSWORD`, and `POSTGRES_PASSWORD`. Existing passwords are preserved. Without `.env`, Compose generates passwords automatically.

After initialization, the credentials volume keeps the passwords across restarts; editing `.env` does not rotate initialized database credentials. `.env` is private and ignored by Git. `.env.example` is a safe template to commit.

## Manage the app

```sh
docker compose ps -a
docker compose logs --tail=100 app mysql postgres
docker compose down
docker compose up -d
```

Database contents, progress, and passwords persist in named volumes. Keep the project name `queryroom`. Do not use `down -v` when you want to retain your data.

Back up progress on the Docker host with `sudo bash scripts/backup-progress.sh`; copy backups off the instance. To import an existing local progress file into a fresh Docker workspace:

```sh
docker compose exec -T app node scripts/migrate-progress.mjs /dev/stdin < .data/progress.json
```

The importer refuses to overwrite existing question progress. Browser-only preferences and custom test cases are not included.

## Development

Local development requires Node.js 24+, MySQL, and PostgreSQL binaries. The local server uses private database instances and saves work in `.data/progress.json`.

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

Application code is in `src/`, `server/`, and `shared/`. Questions and fixtures are in `server/problems/`. `scripts/` contains only Docker initialization, tests, progress import, and backup utilities.

## Question sources

Questions link to their original [LeetCode](https://leetcode.com/) pages. Public statement references: [doocs/leetcode](https://github.com/doocs/leetcode). The imported collection includes the [SQL Hard playlist](https://www.youtube.com/playlist?list=PLtfxzVLWb-B9M7Rx5BrZwZqSBP2_IzRMA). Extra practice tests are local fixtures, not LeetCode's private tests.

Docker configuration and app tests are checked locally. The image build and EC2 startup have not been run on this preparation machine because Docker Engine is unavailable.
