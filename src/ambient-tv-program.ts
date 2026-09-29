import type { Title } from './providers/media-source-provider';

export const TV_PROGRAM_KEY = 'bb_tv_programs';
export type TvProgram = { mode: 'auto' | 'off' | 'loop' } |
  { mode: 'movie'; id: string; sourceId?: string; title: string };
export const AUTO_TV: TvProgram = { mode: 'auto' };

export function loadTvPrograms(raw?: string | null): TvProgram[] {
  try {
    const value: unknown = JSON.parse(raw === undefined ? localStorage.getItem(TV_PROGRAM_KEY) ?? '[]' : raw ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.slice(0, 3).map((p): TvProgram => {
      if (p?.mode === 'movie' && typeof p.id === 'string' && typeof p.title === 'string' &&
          (p.sourceId === undefined || typeof p.sourceId === 'string')) {
        return { mode: 'movie', id: p.id, title: p.title, ...(p.sourceId ? { sourceId: p.sourceId } : {}) };
      }
      return ['off', 'loop'].includes(p?.mode) ? { mode: p.mode } : { ...AUTO_TV };
    });
  } catch { return []; }
}
export function tvMovieEligible(m: Title): boolean {
  return !m.game && !m.isSeries && !m.streaming && !m.discovery && !m.collectionGap && !m.comingSoon;
}
export function tvProgramMovie(program: TvProgram, movies: Title[]): Title | null {
  if (program.mode !== 'movie') return null;
  return movies.find(m => tvMovieEligible(m) && m.id === program.id &&
    (m.sourceId ?? '') === (program.sourceId ?? '')) ?? null;
}
export function tvProgramLabel(p: TvProgram): string {
  return p.mode === 'movie' ? p.title : p.mode === 'off' ? 'OFF' : p.mode === 'loop' ? 'HOUSE PROMO' : 'AUTOMATIC';
}
/** Matching choices share decoding, texture uploads and a server transcode. */
export function groupTvPrograms(programs: TvProgram[], count: number): { program: TvProgram; screens: number[] }[] {
  const groups = new Map<string, { program: TvProgram; screens: number[] }>();
  for (let i = 0; i < count; i++) {
    const p = programs[i] ?? AUTO_TV;
    const key = p.mode === 'movie' ? JSON.stringify([p.mode, p.sourceId ?? '', p.id]) : p.mode;
    if (!groups.has(key)) groups.set(key, { program: p, screens: [] });
    groups.get(key)!.screens.push(i);
  }
  return [...groups.values()];
}
