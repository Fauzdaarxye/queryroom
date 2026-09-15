import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, createHash } from 'node:crypto';
import mysql from 'mysql2/promise';
import pg from 'pg';
import os from 'node:os';
import { engineMode, externalEngineConfig } from './engine-settings.mjs';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.resolve(process.env.QUERYROOM_ENGINE_DIR || path.join(root, '.data/engines'));
const socketDir = path.join(process.platform==='darwin'?'/private/tmp':os.tmpdir(),`queryroom-${createHash('sha256').update(directory).digest('hex').slice(0, 12)}`);
const owned = [];
let starting;
export const engineNames = { mysql: 'MySQL', postgresql: 'PostgreSQL' };

export async function engineConfig() {
  if(engineMode()==='external') return externalEngineConfig();
  const secrets = JSON.parse(await fs.readFile(path.join(directory, 'credentials.json'), 'utf8'));
  return {
    mysql: { socketPath: path.join(socketDir, 'mysql.sock'), user: 'root', password: secrets.mysql, connectTimeout: 3000, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true, multipleStatements: false },
    postgresql: { host: socketDir, port: 55437, database: 'postgres', user: 'queryroom_admin', password: secrets.postgresql, connectionTimeoutMillis: 3000 },
  };
}

export async function adminConnection(engine) {
  const config = (await engineConfig())[engine];
  if (engine === 'mysql') return mysql.createConnection(config);
  const client = new pg.Client(config);
  await client.connect();
  return client;
}

async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
export async function databaseBinary(name) {
  // Homebrew's global mysqld link may belong to MariaDB; prefer real MySQL.
  const formulae = name === 'mysqld' ? ['mysql@8.4', 'mysql'] : ['postgresql@18', 'postgresql@17', 'postgresql'];
  const homebrewFolders = ['/opt/homebrew', '/usr/local'].flatMap(prefix => formulae.map(formula => path.join(prefix, 'opt', formula, 'bin')));
  for (const folder of [...new Set([...homebrewFolders, '/opt/homebrew/bin', '/usr/local/bin', ...(process.env.PATH || '').split(path.delimiter)])]) {
    const candidate = path.join(folder, name);
    if (!(await exists(candidate))) continue;
    if (name === 'mysqld') {
      const { stdout } = await exec(candidate, ['--version'], { timeout: 5000 });
      if (/MariaDB/i.test(stdout)) continue;
    }
    return candidate;
  }
  throw new Error(name === 'mysqld'
    ? 'MySQL is required; MariaDB is not supported. On macOS, run brew install mysql@8.4, then restart Queryroom.'
    : `${name} is required. Install PostgreSQL, then restart Queryroom.`);
}
async function launch(name, args) {
  const log = await fs.open(path.join(directory, `${name}.log`), 'a', 0o600);
  const child = spawn(await databaseBinary(name), args, { stdio: ['ignore', log.fd, log.fd] });
  await log.close();
  child.on('error', () => {});
  owned.push(child);
  return child;
}
async function waitFor(engine, child) {
  for (let n = 0; n < 100; n++) {
    if (child.exitCode !== null) throw new Error(`${engineNames[engine]} could not start. See .data/engines/${engine === 'mysql' ? 'mysqld' : 'postgres'}.log.`);
    try { const client = await adminConnection(engine); await client.end(); return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`${engineNames[engine]} is taking too long to start.`);
}

export function ensureEngines() {
  return starting ||= (async () => {
    if(engineMode()==='external') {
      await externalEngineConfig();
      const status=await engineStatus();
      const unavailable=status.filter(engine=>!engine.available);
      if(unavailable.length) throw new Error(`Could not connect to ${unavailable.map(engine=>engine.name).join(' and ')}. Check the database host, credentials and TLS settings.`);
      return status;
    }
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.mkdir(socketDir, { recursive: true, mode: 0o700 });
    const secretPath = path.join(directory, 'credentials.json');
    if (!(await exists(secretPath))) await fs.writeFile(secretPath, JSON.stringify({mysql: randomBytes(24).toString('hex'), postgresql: randomBytes(24).toString('hex')}), {mode: 0o600, flag: 'wx'});
    const config = await engineConfig();
    const startMysql = async () => {
      try { const client = await adminConnection('mysql'); await client.end(); return; } catch {}
      const data = path.join(directory, 'mysql');
      const fresh = !(await exists(path.join(data, 'mysql')));
      if (fresh) {
        await fs.mkdir(data, { recursive: true, mode: 0o700 });
        await exec(await databaseBinary('mysqld'), ['--no-defaults', '--initialize-insecure', `--datadir=${data}`], { timeout: 60000 });
      }
      const child = await launch('mysqld', ['--no-defaults', `--datadir=${data}`, `--socket=${config.mysql.socketPath}`, `--pid-file=${path.join(data, 'queryroom.pid')}`, '--skip-networking', '--mysqlx=0', '--local-infile=OFF', '--secure-file-priv=NULL', '--innodb-buffer-pool-size=64M', '--max-connections=30', '--performance-schema=OFF']);
      // A newly initialized server has an empty root password and is reachable only through our private socket.
      for (let n = 0; n < 100; n++) {
        try {
          const client = await mysql.createConnection({...config.mysql, password: ''});
          await client.query('ALTER USER CURRENT_USER() IDENTIFIED BY ?', [config.mysql.password]);
          await client.end();
          break;
        } catch (error) {
          if (error.code === 'ER_ACCESS_DENIED_ERROR') break;
          if (child.exitCode !== null) throw new Error('MySQL could not start. See .data/engines/mysqld.log.');
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      await waitFor('mysql', child);
    };
    const startPostgres = async () => {
      try { const client = await adminConnection('postgresql'); await client.end(); return; } catch {}
      const data = path.join(directory, 'postgresql');
      if (!(await exists(path.join(data, 'PG_VERSION')))) {
        const passwordFile = path.join(directory, 'init-password');
        await fs.writeFile(passwordFile, config.postgresql.password, {mode: 0o600});
        try { await exec(await databaseBinary('initdb'), ['-D', data, '-U', 'queryroom_admin', '--auth-local=scram-sha-256', '--auth-host=reject', `--pwfile=${passwordFile}`, '--encoding=UTF8', '--locale=C'], { timeout: 60000 }); }
        finally { await fs.unlink(passwordFile); }
      }
      const child = await launch('postgres', ['-D', data, '-k', socketDir, '-p', '55437', '-c', 'listen_addresses=', '-c', 'max_connections=30', '-c', 'shared_buffers=32MB', '-c', 'work_mem=4MB', '-c', 'unix_socket_permissions=0700']);
      await waitFor('postgresql', child);
    };
    const results = await Promise.allSettled([startMysql(), startPostgres()]);
    const failure = results.find(result => result.status === 'rejected');
    if (failure) {
      await stopEngines();
      throw failure.reason;
    }
    return engineStatus();
  })().finally(() => { starting = undefined; });
}

export async function engineStatus() {
  return Promise.all(Object.entries(engineNames).map(async ([id, name]) => {
    try {
      const client = await adminConnection(id);
      try {
        const result = await client.query('SELECT version() AS version');
        return {id, name, available: true, version: id === 'mysql' ? result[0][0].version : result.rows[0].version.split(' ').slice(0,2).join(' ')};
      } finally { await client.end(); }
    } catch { return {id, name, available: false}; }
  }));
}

export async function stopEngines() {
  await Promise.all(owned.splice(0).map(child => new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill('SIGTERM');
  })));
  starting = undefined;
}
