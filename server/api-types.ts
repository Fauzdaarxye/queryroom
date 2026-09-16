import type {IncomingMessage, ServerResponse} from 'node:http';
import type {Problem} from '../shared/types.ts';
import type {Catalog} from './catalog/store.ts';
import type {createGoogleAuth} from './google-auth.mjs';
import type {createAccountStore} from './account-store.mjs';
export interface ApiDependencies {
  auth: ReturnType<typeof createGoogleAuth>;
  store: Awaited<ReturnType<typeof createAccountStore>>;
  catalog?: Catalog;
  problems?: Map<string, Problem>;
  json(res: ServerResponse, value: unknown, status?: number): void;
  body(req: IncomingMessage, limit?: number): Promise<any>;
}
