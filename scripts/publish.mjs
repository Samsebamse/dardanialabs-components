/**
 * Publish the components to the CDN bucket.
 *
 * Uploads every src/*.js file to the R2 bucket `dardanialabs-master` under
 * `components/v{version}/{filename}` — the version comes from package.json.
 * Published versions are IMMUTABLE: every target key is HEAD-checked first,
 * and if any already exists the whole run aborts. To ship a change, bump the
 * version in package.json and publish again.
 *
 * Required environment (S3-compatible R2 credentials):
 *   CLOUDFLARE_S3_API               endpoint URL of the R2 S3 API
 *   CLOUDFLARE_R2_ACCESS_KEY_ID     access key id
 *   CLOUDFLARE_R2_SECRET_ACCESS_KEY secret access key
 *
 * Run with the env file that holds those values:
 *   node --env-file=<path-to-env> scripts/publish.mjs
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = 'dardanialabs-master';
const CONTENT_TYPE = 'application/javascript; charset=utf-8';
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const missing = [
  'CLOUDFLARE_S3_API',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
].filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  console.error('Run with: node --env-file=<path-to-env> scripts/publish.mjs');
  process.exit(1);
}

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
if (!version) {
  console.error('No "version" field in package.json — aborting.');
  process.exit(1);
}

const srcDir = path.join(root, 'src');
const files = (await readdir(srcDir)).filter((f) => f.endsWith('.js')).sort();
if (!files.length) {
  console.error('No .js files found in src/ — nothing to publish.');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_S3_API,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const keyFor = (file) => `components/v${version}/${file}`;

// Immutable versions: refuse to overwrite anything that is already published.
const existing = [];
for (const file of files) {
  const key = keyFor(file);
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    existing.push(key);
  } catch (error) {
    const status = error.$metadata?.httpStatusCode;
    if (error.name === 'NotFound' || error.name === 'NoSuchKey' || status === 404) continue;
    console.error(`HEAD check failed for ${key}: ${error.name}: ${error.message}`);
    process.exit(1);
  }
}
if (existing.length) {
  console.error(`Aborting — v${version} is already (partially) published; versions are immutable:`);
  for (const key of existing) console.error(`  ${key}`);
  console.error('Bump the version in package.json to publish a new release.');
  process.exit(1);
}

for (const file of files) {
  const key = keyFor(file);
  const body = await readFile(path.join(srcDir, file));
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: CONTENT_TYPE,
    CacheControl: CACHE_CONTROL,
  }));
  console.log(`Uploaded ${key} (${body.length} bytes)`);
}

console.log(`Published v${version}: ${files.length} file(s) to ${BUCKET}.`);
