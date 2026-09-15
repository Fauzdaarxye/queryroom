import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

// Existing deployment environment values take precedence over the local file.
try { loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
