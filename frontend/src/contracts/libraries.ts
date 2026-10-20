import { array, record, text, strings, number } from '../services/validation';

export interface Topic {
  id: string;
  label: string;
}
export interface Word {
  id: string;
  title: string;
  topic: string;
  topicLabel: string;
  category: string;
  aliases: string[];
  custom: boolean;
  authorName: string;
  memeKind: string;
}
export interface WordLibrary {
  builtin: Word[];
  custom: Word[];
  topics: Topic[];
}
const word = (value: unknown): Word => {
  const x = record(value);
  return {
    id: text(x.id),
    title: text(x.title),
    topic: text(x.topic),
    topicLabel: text(x.topicLabel, '綜合'),
    category: text(x.category),
    aliases: strings(x.aliases),
    custom: x.custom === true,
    authorName: text(x.authorName),
    memeKind: text(x.memeKind),
  };
};
export function readWordLibrary(value: unknown): WordLibrary {
  const x = record(value);
  return {
    builtin: array(x.builtin).map(word),
    custom: array(x.custom).map(word),
    topics: array(x.topics).map((v) => {
      const t = record(v);
      return { id: text(t.id), label: text(t.label) };
    }),
  };
}
export interface Gift {
  id: string;
  title: string;
  category: string;
  image: string;
  author: string;
  shared: boolean;
  at: string;
}
export interface Artwork {
  id: string;
  name: string;
  url: string;
  owned: boolean;
  shared: boolean;
  author: string;
}
export function readArtwork(value: unknown): Artwork {
  const x = record(value);
  return {
    id: text(x.id),
    name: text(x.name),
    url: text(x.url),
    owned: x.owned === true,
    shared: x.shared === true,
    author: text(x.author),
  };
}
export function readArtworks(value: unknown): Artwork[] {
  return array(record(value).artworks).map(readArtwork);
}
export function readGiftLibrary(value: unknown) {
  const x = record(value);
  return {
    categories: strings(x.categories),
    gifts: array(x.gifts)
      .map((v) => {
        const g = record(v);
        return {
          id: text(g.id),
          title: text(g.title),
          category: text(g.category),
          image: text(g.image),
          author: text(g.author, 'Afterhours'),
          shared: !!g.shared,
          at: text(g.at),
        } satisfies Gift;
      })
      .sort((a, b) => Number(b.shared) - Number(a.shared) || b.at.localeCompare(a.at)),
  };
}
export interface Track {
  id: string;
  title: string;
  author: string;
  ownerId: string;
  duration: number;
  size: number;
}
export function readMusicLibrary(value: unknown) {
  const x = record(value);
  return {
    me: text(x.me),
    admin: x.admin === true,
    tracks: array(x.tracks).map((v) => {
      const t = record(v);
      return {
        id: text(t.id),
        title: text(t.title),
        author: text(t.author),
        ownerId: text(t.ownerId),
        duration: number(t.duration),
        size: number(t.size),
      } satisfies Track;
    }),
  };
}
