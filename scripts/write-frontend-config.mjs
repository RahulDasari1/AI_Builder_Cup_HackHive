import { readFile, writeFile } from 'node:fs/promises';

const target = new URL('../frontend/src/environments/environment.production.ts', import.meta.url);
const substitutions = {
  __FIREBASE_API_KEY__: process.env.FIREBASE_API_KEY,
  __FIREBASE_AUTH_DOMAIN__: process.env.FIREBASE_AUTH_DOMAIN,
  __FIREBASE_PROJECT_ID__: process.env.FIREBASE_PROJECT_ID,
  __FIREBASE_APP_ID__: process.env.FIREBASE_APP_ID,
  __FIREBASE_MESSAGING_SENDER_ID__: process.env.FIREBASE_MESSAGING_SENDER_ID,
  __LEARNING_API_URL__: process.env.LEARNING_API_URL,
  __AI_API_URL__: process.env.AI_API_URL,
  __REPORTS_API_URL__: process.env.REPORTS_API_URL
};

for (const [placeholder, value] of Object.entries(substitutions)) {
  if (!value) {
    throw new Error(`Missing required build setting: ${placeholder}`);
  }
}

let source = await readFile(target, 'utf8');
for (const [placeholder, value] of Object.entries(substitutions)) {
  source = source.replaceAll(`'${placeholder}'`, JSON.stringify(value));
}
await writeFile(target, source);