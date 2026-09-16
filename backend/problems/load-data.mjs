import { readFileSync } from 'node:fs';
import manifest from '../../database/questions/manifest.json' with { type: 'json' };

// Only this server-side loader reads question fixtures and reference solutions.
// The manifest makes practice order explicit instead of relying on file order.
export function loadQuestionGroup(group) {
  return manifest[group].map((filename) =>
    JSON.parse(
      readFileSync(new URL(`../../database/questions/${filename}`, import.meta.url), 'utf8'),
    ),
  );
}
