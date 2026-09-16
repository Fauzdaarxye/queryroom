CREATE SCHEMA IF NOT EXISTS {{schema}};
REVOKE ALL ON SCHEMA {{schema}} FROM PUBLIC;
CREATE TABLE IF NOT EXISTS {{schema}}.users (
  id uuid PRIMARY KEY, google_subject text UNIQUE NOT NULL, email text NOT NULL, name text NOT NULL,
  guest_import_done boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), last_login timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS {{schema}}.sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  csrf_token text NOT NULL, expires_at timestamptz NOT NULL
);
ALTER TABLE {{schema}}.users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE {{schema}}.users ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE {{schema}}.users ADD COLUMN IF NOT EXISTS age integer CHECK (age BETWEEN 1 AND 120);
ALTER TABLE {{schema}}.users ADD COLUMN IF NOT EXISTS profession text;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON {{schema}}.users (lower(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS sessions_expiry ON {{schema}}.sessions(expires_at);
CREATE TABLE IF NOT EXISTS {{schema}}.oauth_flows (
  state_hash text PRIMARY KEY, binding_hash text NOT NULL, nonce text NOT NULL, verifier text NOT NULL,
  redirect_uri text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_expiry ON {{schema}}.oauth_flows(expires_at);
CREATE TABLE IF NOT EXISTS {{schema}}.progress (
  user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE, slug text NOT NULL,
  data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id, slug)
);
CREATE TABLE IF NOT EXISTS {{schema}}.verified_solves (
  user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  slug text NOT NULL, difficulty text NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard')),
  points integer NOT NULL CHECK (points = CASE difficulty WHEN 'Easy' THEN 10 WHEN 'Medium' THEN 25 WHEN 'Hard' THEN 50 END),
  verified_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id, slug)
);
REVOKE ALL ON ALL TABLES IN SCHEMA {{schema}} FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA {{schema}} REVOKE ALL ON TABLES FROM PUBLIC;
