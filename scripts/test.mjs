import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { ensureEngines, stopEngines } from '../database/connections/engines.mjs';

try {
  await ensureEngines();
  const tests = (await fs.readdir(new URL('../tests/', import.meta.url)))
    .filter((name) => name.endsWith('.test.mjs'))
    .map((name) => `tests/${name}`);
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', '--import', './tests/setup.mjs', '--test', ...tests],
    { stdio: 'inherit' },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
} finally {
  await stopEngines();
}
