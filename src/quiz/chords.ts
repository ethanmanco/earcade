// Chords mode: hear a chord, name its quality.

import {
  CHORD_QUALITIES,
  chordQuality,
  closeVoicing,
  drop2Voicing,
  openVoicing,
  shellVoicing,
  spellQuality,
  voicingName,
  type ChordQuality,
  type Voicing,
} from "../theory/chordQualities";
import { KEYS } from "../theory/keys";
import { noteChroma } from "../theory/spelling";
import type { Rng } from "./rng";
import type { AudioStep, Choice, LevelId, LevelRules, Question } from "./types";

export const TRIADS = ["major", "minor"] as const;
export const SEVENTHS = ["maj7", "dom7", "m7", "m7b5", "dim7"] as const;
export const EXTENDED = ["dom9", "maj9", "m9", "m11", "dom13"] as const;

export interface ChordRules extends LevelRules {
  /** Inversions and other voicings (Master only). */
  voicings: boolean;
}

export const CHORD_LEVELS: Record<LevelId, ChordRules> = {
  beginner: {
    mode: "chords",
    level: "beginner",
    summary: "Major or minor.",
    items: [...TRIADS],
    voicings: false,
    replays: Infinity,
    timeLimit: null,
  },
  intermediate: {
    mode: "chords",
    level: "intermediate",
    summary: "Major, minor, diminished, augmented, sus2 and sus4.",
    items: [...TRIADS, "dim", "aug", "sus2", "sus4"],
    voicings: false,
    replays: Infinity,
    timeLimit: null,
  },
  professional: {
    mode: "chords",
    level: "professional",
    summary: "7th chords: major 7, dominant 7, minor 7, minor 7 flat 5, diminished 7.",
    items: [...SEVENTHS],
    voicings: false,
    replays: Infinity,
    timeLimit: null,
  },
  master: {
    mode: "chords",
    level: "master",
    summary: "7th chords in inversions and drop 2, plus 9ths, 11ths and 13ths in varied voicings. One replay.",
    items: [...SEVENTHS, ...EXTENDED],
    voicings: true,
    replays: 1,
    timeLimit: null,
  },
};

/** Every note stays between E2 and C6, and the bass between E2 and A3. */
export const LOWEST = 40;
export const HIGHEST = 84;
export const BASS_HIGHEST = 57;

function choicesFor(items: readonly string[]): Choice[] {
  return CHORD_QUALITIES.filter((q) => items.includes(q.id)).map((q) => ({ id: q.id, label: q.label, spoken: q.name }));
}

/** Picks the voicing for a question. */
export function pickVoicing(q: ChordQuality, rules: ChordRules, rng: Rng): Voicing {
  if (!rules.voicings) return closeVoicing(q, 0);
  if (q.semitones.length > 4) {
    const all = [closeVoicing(q, 0), openVoicing(q), shellVoicing(q)];
    return all[rng.int(all.length)]!;
  }
  const inversion = rng.int(q.semitones.length);
  return rng.next() < 0.5 ? closeVoicing(q, inversion) : drop2Voicing(q, inversion);
}

/** Root MIDI notes (of the given pitch class) that keep the whole voicing in range. */
export function rootsInRange(chroma: number, offsets: readonly number[]): number[] {
  const lo = Math.min(...offsets);
  const hi = Math.max(...offsets);
  const out: number[] = [];
  for (let m = 24; m <= 96; m++) {
    if (((m % 12) + 12) % 12 !== chroma) continue;
    if (m + lo >= LOWEST && m + lo <= BASS_HIGHEST && m + hi <= HIGHEST) out.push(m);
  }
  return out;
}

export function chordSound(midis: readonly number[]): AudioStep[] {
  return [{ midis: [...midis], at: 0, dur: 2.2 }];
}

export function makeChordQuestion(level: LevelId, itemId: string, rng: Rng): Question {
  const rules = CHORD_LEVELS[level];
  const quality = chordQuality(itemId);
  const voicing = pickVoicing(quality, rules, rng);
  const key = KEYS[rng.int(KEYS.length)]!;
  const spelled = spellQuality(key, quality);
  const roots = rootsInRange(noteChroma(spelled.root), voicing.offsets);
  const root = roots[rng.int(roots.length)]!;
  const midis = voicing.offsets.map((o) => root + o);
  const sound = chordSound(midis);

  const bassName = spelled.notes[voicing.inversion]!;
  const where = voicing.kind === "close" ? "" : `, ${voicingName(voicing)}${voicing.inversion > 0 ? ` (${bassName} in the bass)` : ""}`;
  const explain = `${spelled.root} ${quality.name}${where}: ${spelled.notes.join(" ")}`;

  return {
    mode: "chords",
    level,
    itemId,
    prompt: "Name the chord",
    sound,
    choices: choicesFor(rules.items),
    answer: itemId,
    reveal: sound,
    explain,
    // Another quality on the same root, in root position, so the two can be compared.
    compare: (id) => {
      const other = chordQuality(id);
      const v = closeVoicing(other, 0);
      const r = rootsInRange(noteChroma(spelled.root), v.offsets);
      const base = r.reduce((best, m) => (Math.abs(m - root) < Math.abs(best - root) ? m : best), r[0]!);
      return chordSound(v.offsets.map((o) => base + o));
    },
    detail: { root, rootName: spelled.root, voicing: voicing.kind, inversion: voicing.inversion, midis, notes: spelled.notes.join(" ") },
  };
}
