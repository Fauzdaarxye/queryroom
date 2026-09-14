import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export async function initializeCredentials(directory, env=process.env) {
  await fs.mkdir(directory, {recursive:true, mode:0o755});
  const settings = [
    ['mysql_password', 'MYSQL_PASSWORD'],
    ['postgres_password', 'POSTGRES_PASSWORD'],
  ];
  const saved = {};
  for (const [filename, variable] of settings) {
    const file = path.join(directory, filename);
    let value;
    try { value = (await fs.readFile(file, 'utf8')).trim(); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (value !== undefined) {
      if (!value) throw new Error(`Saved ${filename} is empty. Restore the credentials volume before starting.`);
    } else {
      value = env[variable] || randomBytes(24).toString('base64url');
      if (value.trim() !== value || /[\r\n]/.test(value)) throw new Error(`${variable} must not contain line breaks or leading/trailing spaces.`);
      // Only the application's containers mount this volume; their entrypoint users need read access.
      await fs.writeFile(file, value, {flag:'wx', mode:0o444});
    }
    saved[filename] = value;
  }
  return saved;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await initializeCredentials('/run/queryroom');
  console.log('Queryroom is configured. Database passwords and progress are kept in Docker volumes.');
  console.log('Open http://YOUR_EC2_PUBLIC_IP after the app becomes healthy.');
}
