import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import type { Problem } from '../../shared/types.ts';

// An immutable, compressed migration snapshot. Runtime requests read PostgreSQL.
export async function readSeed(): Promise<Problem[]> {
  const directory = new URL('../seeds/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('catalog-manifest.json', directory), 'utf8'));
  const bytes = gunzipSync(await readFile(new URL('catalog-v1.json.gz', directory)), {
    maxOutputLength: 10_000_000,
  });
  if (createHash('sha256').update(bytes).digest('hex') !== manifest.sha256)
    throw new Error('Catalog migration checksum does not match.');
  const data = JSON.parse(bytes.toString()) as { version: number; problems: Problem[] };
  if (
    data.version !== 1 ||
    data.problems.length !== manifest.questions ||
    data.problems.reduce((sum, p) => sum + p.submissionCases.length, 0) !== manifest.tests
  )
    throw new Error('Catalog migration is incomplete.');
  return data.problems;
}
