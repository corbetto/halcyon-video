import type { JellyfinLibrary, Movie } from './jellyfin.ts';

export const ABOVE_R_LIBRARY_ID = 'halcyon-above-r-room';
export const ABOVE_R_ROOM_WIDTH = 7.5;
const sourceCatalogs = new WeakMap<JellyfinLibrary[], JellyfinLibrary[]>();

/** Only explicit US theatrical ratings above R qualify. Unknown is not adult. */
export function isAboveRMovie(movie: Movie): boolean {
  return !movie.game && !movie.discovery && !movie.collectionGap && !movie.comingSoon
    && /^(NC-17|NC17|X)$/.test((movie.rating ?? '').trim().toUpperCase());
}

/** Preserve source catalog objects; move eligible stock into one room library. */
export function partitionAboveRRoom(libraries: JellyfinLibrary[], enabled: boolean): JellyfinLibrary[] {
  libraries = sourceCatalogs.get(libraries) ?? libraries;
  if (!enabled || libraries.some(lib => lib.id === ABOVE_R_LIBRARY_ID)) return libraries;
  const eligible = new Map<string, Movie>();
  for (const library of libraries) for (const movie of library.movies) {
    if (isAboveRMovie(movie)) eligible.set(movie.id, movie);
  }
  if (!eligible.size) return libraries;
  const ordinary = libraries.map(lib => ({ ...lib, movies: lib.movies.filter(movie => !eligible.has(movie.id)) }));
  const result = [...ordinary, { ...libraries[0], id: ABOVE_R_LIBRARY_ID, name: 'Back Room',
    genres: [...new Set([...eligible.values()].flatMap(movie => movie.genres))],
    movies: [...eligible.values()].map(movie => ({ ...movie, libraryName: 'Back Room' })),
  }];
  sourceCatalogs.set(result, libraries);
  return result;
}
