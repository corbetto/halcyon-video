import type { Title } from './providers/media-source-provider';
import { AUTO_TV, tvMovieEligible, tvProgramLabel, type TvProgram } from './ambient-tv-program.ts';

export interface TvProgramScreen {
  programs: TvProgram[];
  movies: Title[];
  labels: string[];
  screen: number | null;
  index: number;
  query: string;
}
export function initTvProgramScreen(programs: TvProgram[], labels: string[], movies: Title[]): TvProgramScreen {
  return { programs: Array.from({ length: labels.length }, (_, i) => programs[i] ?? { ...AUTO_TV }),
    labels, movies: movies.filter(tvMovieEligible).sort((a,b) => a.title.localeCompare(b.title) || a.year - b.year),
    screen: null, index: 0, query: '' };
}
function options(s: TvProgramScreen): TvProgram[] {
  const matches = s.movies.filter(m => (m.title + ' ' + m.year).toLowerCase().includes(s.query.toLowerCase()));
  const movies: TvProgram[] = matches.map(m => ({ mode: 'movie', id: m.id, ...(m.sourceId ? { sourceId: m.sourceId } : {}),
    title: m.title + (m.year ? ' (' + m.year + ')' : '') }));
  return s.query ? movies : [{ mode: 'auto' }, { mode: 'off' }, { mode: 'loop' }, ...movies];
}
export function tvProgramSearch(s: TvProgramScreen, key: string): TvProgramScreen {
  if (s.screen === null) return s;
  return { ...s, query: key === 'Backspace' ? s.query.slice(0,-1) : (s.query + key).slice(0,60), index: 0 };
}
export function tvProgramKey(s: TvProgramScreen, key: 'up'|'down'|'left'|'right'|'ok'|'back'):
  { state: TvProgramScreen; action?: 'save'|'back' } {
  const picking = s.screen !== null;
  const rows = picking ? options(s) : [];
  const count = picking ? rows.length : s.labels.length + 2;
  if (key === 'back') return picking
    ? { state: { ...s, screen: null, index: s.screen!, query: '' } }
    : { state: s, action: 'back' };
  if (key === 'ok') {
    if (picking) {
      if (!rows[s.index]) return { state: s };
      const programs = [...s.programs]; programs[s.screen!] = rows[s.index];
      return { state: { ...s, programs, screen: null, index: s.screen!, query: '' } };
    }
    if (s.index === s.labels.length) return { state: s, action: 'save' };
    if (s.index > s.labels.length) return { state: s, action: 'back' };
    return { state: { ...s, screen: s.index, index: 0, query: '' } };
  }
  if (!count) return { state: s };
  const step = key === 'up' ? -1 : key === 'down' ? 1 : picking ? (key === 'left' ? -6 : 6) : 0;
  return { state: { ...s, index: (s.index + step % count + count) % count } };
}
export function tvProgramLines(s: TvProgramScreen): { lines: string[]; cursorLine: number } {
  if (s.screen === null) {
    const rows = s.labels.map((label,i) => label + ': ' + tvProgramLabel(s.programs[i]));
    rows.push('SAVE TV CHOICES', 'CANCEL');
    return { lines: ['OVERHEAD TV PROGRAMS', 'CHOOSE A SCREEN', ...rows.map((r,i) =>
      (i === s.index ? '> ' : '  ') + r.slice(0,38)), '', 'FIXED MOVIES REPEAT. AUTO ROTATES.'],
      cursorLine: 2 + s.index };
  }
  const rows = options(s);
  const start = Math.floor(s.index / 6) * 6;
  const lines = ['CHOOSE MOVIE - ' + s.labels[s.screen], ('FIND: ' + s.query + '_').slice(-40),
    ...rows.slice(start,start+6).map((p,i) => (start+i === s.index ? '> ' : '  ') + tvProgramLabel(p).slice(0,38))];
  if (!rows.length) lines.push('NO MATCHING MOVIES');
  lines.push('PAGE ' + (Math.floor(start/6)+1) + '/' + Math.max(1,Math.ceil(rows.length/6)) + '  LEFT/RIGHT: PAGE',
    'TYPE TO FIND. BACK: CANCEL');
  return { lines, cursorLine: rows.length ? 2 + s.index - start : -1 };
}
