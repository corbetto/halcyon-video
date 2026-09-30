import { snapshotSchema, titleKey, titlePath, type Snapshot } from './schema.ts';
import { gzipSync } from 'node:zlib';
import { ARTIFACT_VERSION } from './browse.ts';

export const pageSize = 24;

export interface CatalogArtifacts {
  pageSize: number;
  dataRoot: string;
  pages: Array<{
    schemaVersion: number;
    artifactVersion?: number;
    snapshotVersion: string;
    snapshotHash: string;
    region: string;
    checkedAt: string;
    page: number;
    titles: Snapshot['titles'];
  }>;
  search: {
    schemaVersion: number;
    artifactVersion?: number;
    snapshotVersion: string;
    snapshotHash: string;
    region: string;
    checkedAt: string;
    titles: Array<{
      key: string;
      title: string;
      mediaType: 'movie' | 'tv';
      year: number | null;
      genres: string[];
      path: string;
      services?: string[];
      posterPath?: string|null;
    }>;
  };
  manifest: {
    schemaVersion: number;
    artifactVersion?: number;
    snapshotVersion: string;
    snapshotHash: string;
    region: string;
    checkedAt: string;
    source: string;
    generatedAt: string;
    selection: string;
    coverage: Snapshot['coverage'];
    count: number;
    pages: string[];
    search: string;
  };
}

export function buildCatalogArtifacts(snapshot: unknown, snapshotHash: string, format: 1|2 = ARTIFACT_VERSION): CatalogArtifacts {
  if (typeof snapshotHash !== 'string' || !/^[0-9a-f]{64}$/.test(snapshotHash)) {
    throw new Error('Expected a 64-character lowercase SHA-256 hex hash');
  }

  const parsedSnapshot = snapshotSchema.parse(snapshot);

  // Derived bytes change when the search contract changes, even for identical
  // snapshot bytes. A format suffix prevents overwriting old immutable URLs.
  const dataRoot = `/data/${parsedSnapshot.snapshotVersion}-${snapshotHash.slice(0, 12)}${format===1?'':'-a'+format}`;
  const envelope = {
    schemaVersion: parsedSnapshot.schemaVersion,
    ...(format===2?{artifactVersion:format}:{}),
    snapshotVersion: parsedSnapshot.snapshotVersion,
    snapshotHash,
    region: parsedSnapshot.region,
    checkedAt: parsedSnapshot.checkedAt,
  };

  const pages = Array.from(
    { length: Math.ceil(parsedSnapshot.titles.length / pageSize) },
    (_, index) => ({
      ...envelope,
      page: index + 1,
      titles: parsedSnapshot.titles.slice(index * pageSize, (index + 1) * pageSize),
    })
  );

  const search = {
    ...envelope,
    titles: parsedSnapshot.titles.map((title) => ({
      key: titleKey(title),
      title: title.title,
      mediaType: title.mediaType,
      year: title.year,
      genres: title.genres,
      path: titlePath(title),
      ...(format===2?{services: [...new Set(title.offers.filter(offer => offer.type === 'subscription').map(offer => offer.serviceId))],posterPath:title.posterPath}:{}),
    })),
  };

  const manifest = {
    ...envelope,
    source: parsedSnapshot.source,
    generatedAt: parsedSnapshot.generatedAt,
    selection: parsedSnapshot.selection,
    coverage: parsedSnapshot.coverage,
    count: parsedSnapshot.titles.length,
    pages: pages.map((page) => `${dataRoot}/page-${page.page}.json`),
    search: `${dataRoot}/search.json`,
  };

  if (format===2 && gzipSync(JSON.stringify(search)).length > 250 * 1024)
    throw new Error('Search index exceeds the 250 KiB gzip budget');

  return {
    pageSize,
    dataRoot,
    pages,
    search,
    manifest,
  };
}
