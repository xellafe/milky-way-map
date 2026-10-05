import { describe, expect, it } from 'vitest';

import { buildPlaylist, nextIndex, prevIndex } from '../../src/lib/playlist';

const dir = '../assets/musics/';

describe('buildPlaylist', () => {
  it('returns an empty list for no files', () => {
    expect(buildPlaylist({})).toEqual([]);
  });

  it('sorts numerically by file name and derives titles', () => {
    const files = {
      [`${dir}10 - Ten.mp3`]: '/u/ten.mp3',
      [`${dir}2 - Two.ogg`]: '/u/two.ogg',
      [`${dir}01_First_Song.m4a`]: '/u/first.m4a',
    };
    const list = buildPlaylist(files);
    expect(list.map((t) => t.title)).toEqual(['First Song', 'Two', 'Ten']);
    expect(list.map((t) => t.src)).toEqual(['/u/first.m4a', '/u/two.ogg', '/u/ten.mp3']);
  });

  it.each([
    ['01 - Name.mp3', 'Name'],
    ['01_Name.mp3', 'Name'],
    ['01. Name.mp3', 'Name'],
    ['01.Name.mp3', 'Name'],
    ['1 Name.mp3', 'Name'],
    ['Ambient.mp3', 'Ambient'],
    ['07.mp3', '07'],
  ])('titles %s as %s', (file, title) => {
    expect(buildPlaylist({ [dir + file]: '/u/x' }).map((t) => t.title)).toEqual([title]);
  });
});

describe('playlist index helpers', () => {
  it('stays on the only track', () => {
    expect(nextIndex(0, 1)).toBe(0);
    expect(prevIndex(0, 1)).toBe(0);
  });

  it('wraps around a multi-track list', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
    expect(prevIndex(0, 3)).toBe(2);
    expect(prevIndex(2, 3)).toBe(1);
  });
});
