// Fretboard mode: a note name appears; tap where it is on the guitar neck.
// The one visual mode: nothing plays until you answer, then the note sounds.

import { OPEN_MIDI, STRING_NAMES, midiAt, stringName } from "../theory/guitar";
import { noteChroma } from "../theory/spelling";
import type { FretPos, StringIndex } from "../theory/types";
import type { Rng } from "./rng";
import type { AudioStep, Choice, LevelId, LevelRules, Question } from "./types";

export const NATURALS = ["C", "D", "E", "F", "G", "A", "B"] as const;
export const SHARPS = ["C#", "D#", "F#", "G#", "A#"] as const;
export const FLATS = ["Db", "Eb", "Gb", "Ab", "Bb"] as const;
const ALL_NOTES = [...NATURALS, ...SHARPS, ...FLATS];

export interface FretboardRules extends LevelRules {
  strings: readonly StringIndex[];
  /** Lowest and highest fret used, inclusive. */
  frets: readonly [number, number];
}

const ALL_STRINGS: readonly StringIndex[] = [0, 1, 2, 3, 4, 5];

export const FRETBOARD_LEVELS: Record<LevelId, FretboardRules> = {
  beginner: {
    mode: "fretboard",
    level: "beginner",
    summary: "Natural notes on the two lowest strings, frets 0 to 5.",
    items: [...NATURALS],
    strings: [0, 1],
    frets: [0, 5],
    replays: Infinity,
    timeLimit: null,
  },
  intermediate: {
    mode: "fretboard",
    level: "intermediate",
    summary: "Natural notes on all six strings, frets 0 to 12.",
    items: [...NATURALS],
    strings: ALL_STRINGS,
    frets: [0, 12],
    replays: Infinity,
    timeLimit: null,
  },
  professional: {
    mode: "fretboard",
    level: "professional",
    summary: "Sharps and flats too, all strings, frets 0 to 12.",
    items: ALL_NOTES,
    strings: ALL_STRINGS,
    frets: [0, 12],
    replays: Infinity,
    timeLimit: null,
  },
  master: {
    mode: "fretboard",
    level: "master",
    summary: "Every note on the whole neck to fret 15, 6 seconds each.",
    items: ALL_NOTES,
    strings: ALL_STRINGS,
    frets: [0, 15],
    replays: Infinity,
    timeLimit: 6,
  },
};

/** Choice id for a spot on the neck: "string:fret". */
export const posId = (p: FretPos) => `${p.string}:${p.fret}`;

export function parsePos(id: string): FretPos {
  const [s, f] = id.split(":").map(Number);
  return { string: s as StringIndex, fret: f! };
}

/** "C#" is read as "C sharp". */
export function spokenNote(name: string): string {
  return name.replace("#", " sharp").replace(/^([A-G])b$/, "$1 flat");
}

/** Where a spot is, in words: "A string, fret 5", "low E string, open". */
export function placeName(p: FretPos): string {
  return `${STRING_NAMES[p.string]} string, ${p.fret === 0 ? "open" : `fret ${p.fret}`}`;
}

/** Every spot in the level's range that plays this note. */
export function positionsFor(rules: FretboardRules, name: string): FretPos[] {
  const c = noteChroma(name);
  const out: FretPos[] = [];
  for (const s of rules.strings) {
    for (let f = rules.frets[0]; f <= rules.frets[1]; f++) {
      if (((OPEN_MIDI[s]! + f) % 12 + 12) % 12 === c) out.push({ string: s, fret: f });
    }
  }
  return out;
}

export function noteSound(p: FretPos): AudioStep[] {
  return [{ midis: [midiAt(p)], at: 0, dur: 1.4 }];
}

export function makeFretboardQuestion(level: LevelId, itemId: string, _rng: Rng): Question {
  const rules = FRETBOARD_LEVELS[level];
  const spots = positionsFor(rules, itemId);
  const where = spots.map((p) => `${stringName(p.string)} ${p.fret === 0 ? "open" : p.fret}`).join(", ");
  const choices: Choice[] = rules.items.map((n) => ({ id: n, label: n, spoken: spokenNote(n) }));
  return {
    mode: "fretboard",
    level,
    itemId,
    prompt: "Find",
    sound: [],
    choices,
    answer: itemId,
    accept: spots.map(posId),
    board: { strings: [...rules.strings], frets: [rules.frets[0], rules.frets[1]], note: itemId },
    reveal: noteSound(spots[0]!),
    explain: `${itemId} in this range: ${where}`,
    compare: (id) => noteSound(parsePos(id)),
    detail: { spots: spots.length },
  };
}

