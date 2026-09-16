CREATE SCHEMA IF NOT EXISTS queryroom_catalog;
REVOKE ALL ON SCHEMA queryroom_catalog FROM PUBLIC;
CREATE TABLE IF NOT EXISTS queryroom_catalog.migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS queryroom_catalog.questions (
  id text PRIMARY KEY, slug text NOT NULL UNIQUE, position integer NOT NULL,
  draft_revision integer NOT NULL, published_revision integer,
  created_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS queryroom_catalog.revisions (
  question_id text NOT NULL REFERENCES queryroom_catalog.questions(id), revision integer NOT NULL,
  document jsonb NOT NULL, validation jsonb, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(question_id, revision)
);
CREATE TABLE IF NOT EXISTS queryroom_catalog.test_cases (
  question_id text NOT NULL, revision integer NOT NULL, id text NOT NULL,
  position integer NOT NULL, name text NOT NULL, kind text NOT NULL, description text,
  input jsonb NOT NULL, expected jsonb, visible boolean NOT NULL,
  PRIMARY KEY(question_id, revision, id),
  FOREIGN KEY(question_id, revision) REFERENCES queryroom_catalog.revisions(question_id, revision)
);
CREATE TABLE IF NOT EXISTS queryroom_catalog.reference_solutions (
  question_id text NOT NULL, revision integer NOT NULL, engine text NOT NULL CHECK(engine IN ('mysql','postgresql')),
  sql text NOT NULL, PRIMARY KEY(question_id, revision, engine),
  FOREIGN KEY(question_id, revision) REFERENCES queryroom_catalog.revisions(question_id, revision)
);
CREATE TABLE IF NOT EXISTS queryroom_catalog.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid, question_id text NOT NULL,
  revision integer NOT NULL, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ALL TABLES IN SCHEMA queryroom_catalog FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA queryroom_catalog REVOKE ALL ON TABLES FROM PUBLIC;
