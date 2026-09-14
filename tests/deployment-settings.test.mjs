import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {createAccess} from '../server/access.mjs';
import {engineMode,externalEngineConfig} from '../server/engine-settings.mjs';
import {createFileStateStore,createPostgresStateStore} from '../server/state-store.mjs';
import {adminConnection} from '../server/engines.mjs';
import {initializeCredentials} from '../scripts/docker-init.mjs';

const password=randomBytes(24).toString('hex');
test('external databases use supplied TCP credentials with certificate verification',async()=>{
  const env={MYSQL_HOST:'mysql.example.test',MYSQL_PORT:'3307',MYSQL_USER:'admin',MYSQL_PASSWORD:password,MYSQL_SSL:'true',POSTGRES_HOST:'pg.example.test',POSTGRES_PORT:'5433',POSTGRES_USER:'admin',POSTGRES_PASSWORD:password,POSTGRES_DB:'queryroom',POSTGRES_SSL:'true'};
  const config=await externalEngineConfig(env);
  assert.equal(config.mysql.socketPath,undefined);
  assert.equal(config.mysql.host,env.MYSQL_HOST);
  assert.equal(config.mysql.port,3307);
  assert.equal(config.mysql.ssl.rejectUnauthorized,true);
  assert.equal(config.postgresql.ssl.rejectUnauthorized,true);
  assert.equal(config.postgresql.database,'queryroom');
  await assert.rejects(externalEngineConfig({...env,MYSQL_PASSWORD:''}),/MYSQL_PASSWORD/);
  await assert.rejects(externalEngineConfig({...env,MYSQL_PORT:'invalid'}),/ports/);
  assert.throws(()=>engineMode({QUERYROOM_ENGINE_MODE:'unexpected'}),/local or external/);
});
test('configured origins remain restricted without requiring a workspace password',async()=>{
  await assert.rejects(createAccess({HOST:'0.0.0.0'}),/ORIGINS/);
  await assert.rejects(createAccess({HOST:'0.0.0.0',QUERYROOM_ALLOWED_ORIGINS:'http://app.example.test'}),/HTTPS/);
  const access=await createAccess({HOST:'0.0.0.0',QUERYROOM_ALLOWED_ORIGINS:'https://app.example.test',QUERYROOM_ACCESS_PASSWORD_FILE:'/nonexistent/old-workspace-password'});
  assert.equal(access.accepts({headers:{host:'app.example.test',origin:'https://app.example.test'}}),true);
  assert.equal(access.accepts({headers:{host:'app.example.test',origin:'https://attacker.example'}}),false);
  assert.equal(access.accepts({headers:{host:'attacker.example'}}),false);
});
test('local startup retains the existing address restrictions',async()=>{
  const access=await createAccess({});
  assert.equal(access.host,'127.0.0.1');
  assert.equal(access.accepts({headers:{host:'localhost:4317'}}),true);
});
test('Compose accepts its HTTP address without login while rejecting cross-origin requests',async()=>{
  const access=await createAccess({HOST:'0.0.0.0',QUERYROOM_AUTO_ORIGIN:'true'});
  for(const host of ['203.0.113.25','ec2-example.compute.amazonaws.com','localhost:8080']) {
    assert.equal(access.accepts({headers:{host,origin:`http://${host}`}}),true);
    assert.equal(access.accepts({headers:{host,origin:'http://another.example'}}),false);
    assert.equal(access.accepts({headers:{host,origin:'null'}}),false);
  }
  for(const host of ['', 'user@example.com', 'example.com/path', 'example.com#fragment']) assert.equal(access.accepts({headers:{host}}),false);
});
test('Compose generates separate passwords once and reuses them after restart',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'queryroom-credentials-test-'));
  try {
    const first=await initializeCredentials(dir,{});
    assert.equal(new Set(Object.values(first)).size,2);
    assert.equal(first.workspace_password,undefined);
    for(const [file,value] of Object.entries(first)) {
      assert.ok(value.length>=32);
      assert.equal((await fs.stat(path.join(dir,file))).mode & 0o777,0o444);
    }
    assert.deepEqual(await initializeCredentials(dir,{}),first);
    assert.deepEqual(await initializeCredentials(dir,{MYSQL_PASSWORD:'changed-input'}),first);
    const config=await externalEngineConfig({MYSQL_HOST:'mysql',MYSQL_USER:'root',MYSQL_PASSWORD_FILE:path.join(dir,'mysql_password'),POSTGRES_HOST:'postgres',POSTGRES_USER:'queryroom_admin',POSTGRES_DB:'queryroom',POSTGRES_PASSWORD_FILE:path.join(dir,'postgres_password')});
    assert.equal(config.mysql.password,first.mysql_password);
    assert.equal(config.postgresql.password,first.postgres_password);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});
test('Compose preserves passwords supplied for an existing database on first initialization',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'queryroom-existing-credentials-test-'));
  try {
    const saved=await initializeCredentials(dir,{MYSQL_PASSWORD:'existing-mysql',POSTGRES_PASSWORD:'existing-postgres',QUERYROOM_ACCESS_PASSWORD:password});
    assert.equal(saved.mysql_password,'existing-mysql');
    assert.equal(saved.postgres_password,'existing-postgres');
    assert.equal(saved.workspace_password,undefined);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});
test('file progress is retained and concurrent draft/submission saves merge safely',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'queryroom-state-test-'));
  const original={example:{draft:'existing query',notes:'existing notes',solved:true,bookmarked:true,submissions:[]}};
  await fs.writeFile(path.join(dir,'progress.json'),JSON.stringify(original));
  const store=await createFileStateStore(dir);
  assert.deepEqual(await store.read(),original);
  await Promise.all([store.patch('example',{draft:'new query'}),store.recordSubmission('example',{id:'test',verdict:'Wrong Answer',sql:'submitted query'})]);
  await store.close();
  const reloaded=await createFileStateStore(dir),saved=(await reloaded.read()).example;
  assert.equal(saved.draft,'new query');
  assert.equal(saved.notes,'existing notes');
  assert.equal(saved.solved,true);
  assert.equal(saved.submissions[0].id,'test');
  await reloaded.close();await fs.rm(dir,{recursive:true});
});
test('PostgreSQL progress survives new instances without losing concurrent updates',async()=>{
  const slug=`deployment-test-${randomBytes(12).toString('hex')}`;
  const [first,second]=await Promise.all([createPostgresStateStore(),createPostgresStateStore()]);
  try {
    await Promise.all([first.patch(slug,{draft:'saved query'}),second.patch(slug,{notes:'saved notes'}),first.recordSubmission(slug,{id:'one',verdict:'Accepted'}),second.recordSubmission(slug,{id:'two',verdict:'Wrong Answer'})]);
    const fresh=await createPostgresStateStore(),saved=(await fresh.read())[slug];
    assert.equal(saved.draft,'saved query');assert.equal(saved.notes,'saved notes');assert.equal(saved.solved,true);assert.equal(saved.submissions.length,2);
    await fresh.close();
  } finally {
    const admin=await adminConnection('postgresql');
    try {await admin.query('DELETE FROM queryroom_state.progress WHERE slug=$1',[slug]);}finally{await admin.end();}
    await first.close();await second.close();
  }
});
