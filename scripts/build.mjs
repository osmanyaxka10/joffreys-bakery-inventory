import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, '');
const output = path.join(root, 'dist');
const excluded = new Set(['.git', '.vercel', 'node_modules', 'dist', 'scripts', '.env', '.env.local', '.env.production', '.env.development', 'package.json', 'package-lock.json']);
await mkdir(output, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (excluded.has(entry.name) || entry.name.startsWith('.env.')) continue;
  await cp(path.join(root, entry.name), path.join(output, entry.name), { recursive: true, force: true });
}

const token = process.env.POSTHOG_PROJECT_TOKEN || '';
const apiHost = process.env.POSTHOG_HOST || '';
if (!token || !apiHost) {
  console.warn('PostHog is not configured for this deployment. Set POSTHOG_PROJECT_TOKEN and POSTHOG_HOST in Vercel.');
}
await writeFile(
  path.join(output, 'posthog-config.js'),
  'window.__POSTHOG_CONFIG__ = ' + JSON.stringify({ token, apiHost }) + ';\n',
  'utf8'
);
console.log('Static bakery app prepared in dist/.');
