import pg from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { emptyProgress, mergeImportedProgress } from '../shared/progress.mjs';
import { validateProfile } from '../shared/profile.mjs';
import { verifiedPoints, leaderboardPageSize } from '../shared/leaderboard.mjs';

export const hashToken = token => createHash('sha256').update(token).digest('hex');
const publicUser = row => ({ id: row.id, name: row.full_name || row.name, email: row.email,
  username: row.username || null, fullName: row.full_name || null, age: row.age ?? null,
  profession: row.profession || null, profileComplete: Boolean(row.username && row.full_name && row.age && row.profession),
  joinedAt: row.created_at, guestImportDone: row.guest_import_done });

export async function createAccountStore({ config, schema = 'queryroom_accounts' }) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) throw new Error('Invalid account schema.');
  const s = `"${schema}"`;
  const pool = new pg.Pool({ ...config, max: 5, idleTimeoutMillis: 10000, statement_timeout: 10000 });
  pool.on('error', error => console.error('Account database connection interrupted:', error.code || 'unknown'));
  try {
    await pool.query(`
      CREATE SCHEMA IF NOT EXISTS ${s};
      REVOKE ALL ON SCHEMA ${s} FROM PUBLIC;
      CREATE TABLE IF NOT EXISTS ${s}.users (
        id uuid PRIMARY KEY, google_subject text UNIQUE NOT NULL, email text NOT NULL, name text NOT NULL,
        guest_import_done boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), last_login timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS ${s}.sessions (
        token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES ${s}.users(id) ON DELETE CASCADE,
        csrf_token text NOT NULL, expires_at timestamptz NOT NULL
      );
      ALTER TABLE ${s}.users ADD COLUMN IF NOT EXISTS username text;
      ALTER TABLE ${s}.users ADD COLUMN IF NOT EXISTS full_name text;
      ALTER TABLE ${s}.users ADD COLUMN IF NOT EXISTS age integer CHECK (age BETWEEN 1 AND 120);
      ALTER TABLE ${s}.users ADD COLUMN IF NOT EXISTS profession text;
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON ${s}.users (lower(username)) WHERE username IS NOT NULL;
      CREATE INDEX IF NOT EXISTS sessions_expiry ON ${s}.sessions(expires_at);
      CREATE TABLE IF NOT EXISTS ${s}.oauth_flows (
        state_hash text PRIMARY KEY, binding_hash text NOT NULL, nonce text NOT NULL, verifier text NOT NULL,
        redirect_uri text NOT NULL, expires_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS oauth_expiry ON ${s}.oauth_flows(expires_at);
      CREATE TABLE IF NOT EXISTS ${s}.progress (
        user_id uuid NOT NULL REFERENCES ${s}.users(id) ON DELETE CASCADE, slug text NOT NULL,
        data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id, slug)
      );
      CREATE TABLE IF NOT EXISTS ${s}.verified_solves (
        user_id uuid NOT NULL REFERENCES ${s}.users(id) ON DELETE CASCADE,
        slug text NOT NULL, difficulty text NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard')),
        points integer NOT NULL CHECK (points = CASE difficulty WHEN 'Easy' THEN 10 WHEN 'Medium' THEN 25 WHEN 'Hard' THEN 50 END),
        verified_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id, slug)
      );
      REVOKE ALL ON ALL TABLES IN SCHEMA ${s} FROM PUBLIC;
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${s} REVOKE ALL ON TABLES FROM PUBLIC;
    `);
  } catch (error) { await pool.end(); throw error; }
  async function transaction(action) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await action(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async function mutateWith(client, userId, slug, update) {
    await client.query(`INSERT INTO ${s}.progress(user_id,slug,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [userId, slug, emptyProgress()]);
    const current = (await client.query(`SELECT data FROM ${s}.progress WHERE user_id=$1 AND slug=$2 FOR UPDATE`, [userId, slug])).rows[0].data;
    const next = update({ ...emptyProgress(), ...current });
    await client.query(`UPDATE ${s}.progress SET data=$3,updated_at=now() WHERE user_id=$1 AND slug=$2`, [userId, slug, next]);
    return next;
  }
  async function awardWith(client, userId, problem, submission) {
    const points = verifiedPoints(problem, submission);
    if (!points) return 0;
    const award = await client.query(`INSERT INTO ${s}.verified_solves(user_id,slug,difficulty,points)
      VALUES($1,$2,$3,$4) ON CONFLICT(user_id,slug) DO NOTHING`, [userId, problem.slug, problem.difficulty, points]);
    return award.rowCount ? points : 0;
  }
  return {
    async upsertGoogleUser({ sub, email, name }) {
      const result = await pool.query(`INSERT INTO ${s}.users(id,google_subject,email,name) VALUES($1,$2,$3,$4)
        ON CONFLICT(google_subject) DO UPDATE SET email=excluded.email,name=excluded.name,last_login=now() RETURNING *`, [randomUUID(), sub, email, name]);
      return publicUser(result.rows[0]);
    },
    async createSession(userId) {
      const token = randomBytes(32).toString('base64url'), csrfToken = randomBytes(32).toString('base64url');
      await pool.query(`DELETE FROM ${s}.sessions WHERE expires_at<=now()`);
      await pool.query(`INSERT INTO ${s}.sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+interval '30 days')`, [hashToken(token), userId, csrfToken]);
      return { token, csrfToken };
    },
    async saveProfile(userId, input) {
      const profile = validateProfile(input);
      try {
        const result = await pool.query(`UPDATE ${s}.users SET username=$2,full_name=$3,age=$4,profession=$5 WHERE id=$1 RETURNING *`,
          [userId, profile.username, profile.fullName, profile.age, profile.profession]);
        if (!result.rowCount) throw Object.assign(new Error('Your account could not be found. Please sign in again.'), {status: 401});
        return publicUser(result.rows[0]);
      } catch (error) {
        if (error.code === '23505') throw Object.assign(new Error('That username is already taken. Choose another one.'), {status: 409});
        throw error;
      }
    },
    async session(token) {
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
      const row = (await pool.query(`SELECT u.*,s.csrf_token FROM ${s}.sessions s JOIN ${s}.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`, [hashToken(token)])).rows[0];
      return row ? { user: publicUser(row), csrfToken: row.csrf_token } : null;
    },
    async deleteSession(token) { if (token) await pool.query(`DELETE FROM ${s}.sessions WHERE token_hash=$1`, [hashToken(token)]); },
    async createFlow({ state, binding, nonce, verifier, redirectUri }) {
      await pool.query(`DELETE FROM ${s}.oauth_flows WHERE expires_at<=now()`);
      await pool.query(`INSERT INTO ${s}.oauth_flows(state_hash,binding_hash,nonce,verifier,redirect_uri,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes')`, [hashToken(state), hashToken(binding), nonce, verifier, redirectUri]);
    },
    async consumeFlow(state, binding) {
      if (!state || !binding || state.length > 100 || binding.length > 100) return null;
      return (await pool.query(`DELETE FROM ${s}.oauth_flows WHERE state_hash=$1 AND binding_hash=$2 AND expires_at>now() RETURNING *`, [hashToken(state), hashToken(binding)])).rows[0] || null;
    },
    async readProgress(userId, slugs) {
      const rows = (await pool.query(`SELECT slug,data FROM ${s}.progress WHERE user_id=$1 AND slug=ANY($2::text[])`, [userId, slugs])).rows;
      const saved = Object.fromEntries(slugs.map(slug => [slug, emptyProgress()]));
      for (const row of rows) saved[row.slug] = { ...emptyProgress(), ...row.data };
      return saved;
    },
    patchProgress: (userId, slug, patch) => transaction(client => mutateWith(client, userId, slug, current => ({ ...current, ...patch }))),
    toggleBookmark: (userId, slug) => transaction(client => mutateWith(client, userId, slug, current => ({ ...current, bookmarked: !current.bookmarked }))),
    recordSubmission: (userId, problem, submission) => transaction(async client => {
      const progress = await mutateWith(client, userId, problem.slug, current => ({ ...current,
        solved: current.solved || submission.verdict === 'Accepted',
        submissions: [submission, ...current.submissions.filter(item => item.id !== submission.id)].slice(0, 100) }));
      const pointsEarned = await awardWith(client, userId, problem, submission);
      return { progress, pointsEarned };
    }),
    creditVerifiedSolution: (userId, problem, submission) => awardWith(pool, userId, problem, submission),
    async unscoredAccepted() {
      return (await pool.query(`SELECT p.user_id,p.slug,p.data->'submissions' AS submissions FROM ${s}.progress p
        WHERE NOT EXISTS (SELECT 1 FROM ${s}.verified_solves v WHERE v.user_id=p.user_id AND v.slug=p.slug)
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(p.data->'submissions') item WHERE item->>'verdict'='Accepted')
        ORDER BY p.user_id,p.slug`)).rows;
    },
    async leaderboard({ search = '', page = 1, userId = null } = {}) {
      search = String(search).slice(0, 24).trim().toLowerCase();
      page = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1;
      const result = await pool.query(`WITH totals AS (
        SELECT u.id,u.username,COALESCE(sum(v.points),0)::integer AS points,count(v.slug)::integer AS solved,
          count(v.slug) FILTER (WHERE v.difficulty='Easy')::integer AS easy,
          count(v.slug) FILTER (WHERE v.difficulty='Medium')::integer AS medium,
          count(v.slug) FILTER (WHERE v.difficulty='Hard')::integer AS hard
        FROM ${s}.users u LEFT JOIN ${s}.verified_solves v ON v.user_id=u.id
        WHERE u.username IS NOT NULL GROUP BY u.id
      ), ranked AS (
        SELECT *,rank() OVER (ORDER BY points DESC)::integer AS rank FROM totals
      ), visible AS (
        SELECT * FROM ranked WHERE strpos(lower(username),$1)>0
      ), counts AS (
        SELECT (SELECT count(*)::integer FROM ranked) AS users,count(*)::integer AS matches,
          greatest(1,ceil(count(*)::numeric / $3)::integer) AS pages FROM visible
      ), paged AS (
        SELECT * FROM visible ORDER BY points DESC,lower(username),id
        LIMIT $3 OFFSET ((SELECT least($2,pages) FROM counts)-1)*$3
      )
      SELECT counts.*,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('rank',rank,'username',username,'points',points,
          'solved',solved,'easy',easy,'medium',medium,'hard',hard,'isYou',COALESCE(id=$4::uuid,false))
          ORDER BY points DESC,lower(username),id) FROM paged),'[]'::jsonb) AS entries,
        (SELECT jsonb_build_object('rank',rank,'username',username,'points',points,'solved',solved,
          'easy',easy,'medium',medium,'hard',hard,'isYou',true) FROM ranked WHERE id=$4::uuid) AS current_user
      FROM counts`, [search, page, leaderboardPageSize, userId]);
      const row = result.rows[0];
      return { entries: row.entries, currentUser: row.current_user, totalUsers: row.users, totalResults: row.matches,
        page: Math.min(page, row.pages), pages: row.pages, pageSize: leaderboardPageSize };
    },
    async importGuest(userId, saved) {
      return transaction(async client => {
        const user = (await client.query(`SELECT * FROM ${s}.users WHERE id=$1 FOR UPDATE`, [userId])).rows[0];
        if (!user.guest_import_done) {
          for (const slug of Object.keys(saved).sort()) await mutateWith(client, userId, slug, current => mergeImportedProgress(current, saved[slug]));
          await client.query(`UPDATE ${s}.users SET guest_import_done=true WHERE id=$1`, [userId]);
        }
        return { ...publicUser(user), guestImportDone: true };
      });
    },
    close: () => pool.end(),
  };
}
