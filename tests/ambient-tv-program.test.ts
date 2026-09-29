import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Title } from '../src/providers/media-source-provider.ts';
import { groupTvPrograms, loadTvPrograms, tvProgramMovie, tvMovieEligible } from '../src/ambient-tv-program.ts';
import { initTvProgramScreen, tvProgramKey, tvProgramSearch, tvProgramLines } from '../src/tv-program-screen.ts';
const movie = (id: string, title: string, extra: Partial<Title> = {}): Title => ({
 id, title, year: 1985, duration: '90', rating: 'PG', overview: '', director: '', actors: [],
 genres: [], localPath: '', ...extra });
test('fixed TV identities survive storage and distinguish servers with equal item ids', () => {
 const programs = loadTvPrograms(JSON.stringify([{mode:'movie',id:'1',sourceId:'second',title:'B'}]));
 const a=movie('1','A',{sourceId:'first'}), b=movie('1','B',{sourceId:'second'});
 assert.equal(tvProgramMovie(programs[0],[a,b]),b);
 assert.equal(tvProgramMovie(programs[0],[a]),null);
 assert.deepEqual(loadTvPrograms('broken'),[]);
 assert.deepEqual(loadTvPrograms('[{"mode":"movie","id":2}]'),[{mode:'auto'}]);
});
test('only locally playable movies are offered', () => {
 for (const flag of ['game','isSeries','streaming','discovery','collectionGap','comingSoon']) {
  assert.equal(tvMovieEligible(movie('1','X',{[flag]:true})),false,flag);
 }
 assert.equal(tvMovieEligible(movie('1','X')),true);
});
test('same film on multiple screens shares one feed while differing servers remain separate', () => {
 const a={mode:'movie' as const,id:'1',sourceId:'first',title:'A'};
 assert.deepEqual(groupTvPrograms([a,{...a,title:'renamed'}],2).map(g=>g.screens),[[0,1]]);
 assert.equal(groupTvPrograms([a,{...a,sourceId:'second'}],2).length,2);
 assert.deepEqual(groupTvPrograms([{mode:'off'}],3).map(g=>g.screens),[[0],[1,2]]);
});
test('terminal searches, selects independently, cancels a picker and explicitly saves', () => {
 let s=initTvProgramScreen([],['TV 1 LEFT','TV 2 RIGHT'],[movie('a','Alpha'),movie('b','Beta')]);
 s=tvProgramKey(s,'ok').state;
 for (const ch of 'Beta') s=tvProgramSearch(s,ch);
 s=tvProgramKey(s,'ok').state;
 assert.equal(s.programs[0].mode,'movie');
 assert.equal(s.programs[1].mode,'auto');
 s=tvProgramKey(s,'down').state;
 s=tvProgramKey(s,'ok').state;
 s=tvProgramKey(s,'down').state;
 s=tvProgramKey(s,'back').state;
 assert.equal(s.programs[1].mode,'auto');
 s=tvProgramKey(s,'down').state;
 assert.equal(tvProgramKey(s,'ok').action,'save');
 assert.deepEqual(loadTvPrograms(JSON.stringify(s.programs)),s.programs);
});
test('large catalogs page without overflowing the CRT; an empty search is safe', () => {
 let s=initTvProgramScreen([],['TV 1 LEFT'],Array.from({length:100},(_,i)=>movie(String(i),'A long movie title '+i)));
 s=tvProgramKey(s,'ok').state;
 s=tvProgramKey(s,'right').state;
 assert.equal(s.index,6);
 let screen=tvProgramLines(s);
 assert.ok(screen.lines.length<=10);
 assert.ok(screen.lines.every(line=>line.length<=40));
 s=tvProgramSearch(s,'~');
 assert.equal(tvProgramKey(s,'ok').state,s);
 assert.ok(tvProgramLines(s).lines.includes('NO MATCHING MOVIES'));
});
