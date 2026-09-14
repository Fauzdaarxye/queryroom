import fs from 'node:fs/promises';
import path from 'node:path';
import { adminConnection } from './engines.mjs';

const empty = () => ({draft:null,notes:'',bookmarked:false,solved:false,submissions:[]});
const methods = store => ({
  ...store,
  patch(slug,patch) {return store.mutate(slug,current=>({...current,...patch}));},
  recordSubmission(slug,submission) {return store.mutate(slug,current=>({...current,solved:current.solved||submission.verdict==='Accepted',submissions:[submission,...current.submissions].slice(0,100)}));},
});

export async function createFileStateStore(directory) {
  await fs.mkdir(directory,{recursive:true});
  const file=path.join(directory,'progress.json');
  let state={};
  try {state=JSON.parse(await fs.readFile(file,'utf8'));} catch(error) {if(error.code!=='ENOENT') throw new Error('Could not read saved progress. The original file has been kept.');}
  let queue=Promise.resolve();
  return methods({
    async read() {return structuredClone(state);},
    mutate(slug,update) {
      queue=queue.catch(()=>{}).then(async()=>{
        const next=update({...empty(),...state[slug]});
        const snapshot={...state,[slug]:next};
        await fs.writeFile(`${file}.tmp`,JSON.stringify(snapshot,null,2));
        await fs.rename(`${file}.tmp`,file);
        state=snapshot;
        return structuredClone(next);
      });
      return queue;
    },
    async close() {await queue;},
  });
}

export async function createPostgresStateStore(connect=()=>adminConnection('postgresql')) {
  const client=await connect();
  try {
    await client.query('SELECT pg_advisory_lock(714317)');
    // This schema is never granted to temporary practice-query users.
    await client.query('CREATE SCHEMA IF NOT EXISTS queryroom_state');
    await client.query('REVOKE ALL ON SCHEMA queryroom_state FROM PUBLIC');
    await client.query("CREATE TABLE IF NOT EXISTS queryroom_state.progress (slug TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  } finally {await client.query('SELECT pg_advisory_unlock(714317)').catch(()=>{});await client.end();}
  return methods({
    async read() {
      const client=await connect();
      try {return Object.fromEntries((await client.query('SELECT slug,data FROM queryroom_state.progress')).rows.map(row=>[row.slug,row.data]));}
      finally {await client.end();}
    },
    async mutate(slug,update) {
      const client=await connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO queryroom_state.progress (slug) VALUES ($1) ON CONFLICT DO NOTHING',[slug]);
        const result=await client.query('SELECT data FROM queryroom_state.progress WHERE slug=$1 FOR UPDATE',[slug]);
        const next=update({...empty(),...result.rows[0].data});
        await client.query('UPDATE queryroom_state.progress SET data=$2::jsonb,updated_at=now() WHERE slug=$1',[slug,JSON.stringify(next)]);
        await client.query('COMMIT');
        return next;
      } catch(error) {await client.query('ROLLBACK').catch(()=>{});throw error;}
      finally {await client.end();}
    },
    async close() {},
  });
}
