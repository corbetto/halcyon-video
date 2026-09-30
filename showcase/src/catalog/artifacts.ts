import { snapshotSchema, titleKey, titlePath, type Snapshot } from './schema.ts';

export const pageSize = 24;

export interface CatalogArtifacts {
  pageSize: number;
  dataRoot: string;
  pages: Array<{
    schemaVersion: number;
    snapshotVersion: string;
    snapshotHash: string;
    region: string;
    checkedAt: string;
    page: number;
    titles: Snapshot['titles'];
  }>;
  search: {
    schemaVersion: number;
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
    }>;
  };
  manifest: {
    schemaVersion: number;
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

export function buildCatalogArtifacts(snapshot: unknown, snapshotHash: string): CatalogArtifacts {
  if (typeof snapshotHash !== 'string' || !/^[0-9a-f]{64}$/.test(snapshotHash)) {
    throw new Error('Expected a 64-character lowercase SHA-256 hex hash');
  }

  const parsedSnapshot = snapshotSchema.parse(snapshot);

  const dataRoot = `/data/${parsedSnapshot.snapshotVersion}-${snapshotHash.slice(0, 12)}`;
  const envelope = {
    schemaVersion: parsedSnapshot.schemaVersion,
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

  return {
    pageSize,
    dataRoot,
    pages,
    search,
    manifest,
  };
}
