import fs from 'node:fs/promises';
import { createPostgresStateStore } from '../server/state-store.mjs';
import { problems } from '../server/problems/index.mjs';

const filename=process.argv[2];
if(!filename || process.env.QUERYROOM_ENGINE_MODE!=='external') throw new Error('Use an external-database environment and pass the path to the progress.json file to import.');
const source=JSON.parse(await fs.readFile(filename,'utf8'));
if(!source || Array.isArray(source) || typeof source!=='object') throw new Error('Invalid progress file.');
for(const [slug,data] of Object.entries(source)) if(!problems.has(slug) || !data || typeof data!=='object' || Array.isArray(data)) throw new Error(`Invalid progress entry: ${slug}`);
const store=await createPostgresStateStore();
try {
  const existing=await store.read();
  if(Object.keys(source).some(slug=>existing[slug])) throw new Error('The hosted workspace already has progress for one of these questions. Import stopped without changing that progress.');
  for(const [slug,data] of Object.entries(source)) await store.mutate(slug,current=>{
    if(current.draft!==null || current.notes || current.solved || current.bookmarked || current.submissions.length) throw new Error('Progress changed during the import. Existing work has been kept.');
    return {...current,...data};
  });
  console.log(`Imported progress for ${Object.keys(source).length} questions.`);
} finally {await store.close();}
