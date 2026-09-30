import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { snapshotSchema } from './schema.ts';
import { buildCatalogArtifacts } from './artifacts.ts';

const input = process.env.SHOWCASE_SNAPSHOT || 'fixtures/browse.json';
const bytes = readFileSync(input);
export const snapshot = snapshotSchema.parse(JSON.parse(bytes.toString()));
// Public upstream artifacts remain gated until #354 records source permission.
if (snapshot.source !== 'fixture') throw new Error('Live data requires the source permission gate in #354.');
export const snapshotHash = createHash('sha256').update(bytes).digest('hex');

const artifacts = buildCatalogArtifacts(snapshot, snapshotHash);
export const pageSize = artifacts.pageSize;
export const dataRoot = artifacts.dataRoot;
export const pages = artifacts.pages;
export const search = artifacts.search;
export const manifest = artifacts.manifest;
