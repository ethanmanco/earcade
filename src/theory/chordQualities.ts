// Chord qualities from triads to 13ths, their voicings, and how to spell
// them in any key. Pure theory: no sound, no screen.

import { Chord } from "tonal";
import { plainNames, readableRoot } from "./scales";

export interface ChordQuality {
  /** Item id, e.g. "maj7". */
  id: string;
  /**
   * Button text. Capitals-only font, so never "m" vs "M" ("min 7", "maj 7"),
   * and never a note-like "b5": minor 7 flat 5 shows as "half dim".
   */
  label: string;
  /** Name read aloud and shown small, e.g. "dominant 7". */
  name: string;
  /** Chord symbol tonal understands, e.g. "m7b5". */
  tonal: string;
  /** Semitones above the root, low to high, as stacked in root position. */
  semitones: readonly number[];
  /** Indexes of tones a voicing may leave out (only a plain perfect 5th in extended chords). */
  optional?: readonly number[];
}

export const CHORD_QUALITIES: readonly ChordQuality[] = [
  { id: "major", label: "major", name: "major", tonal: "M", semitones: [0, 4, 7] },
  { id: "minor", label: "minor", name: "minor", tonal: "m", semitones: [0, 3, 7] },
  { id: "dim", label: "dim", name: "diminished", tonal: "dim", semitones: [0, 3, 6] },
  { id: "aug", label: "aug", name: "augmented", tonal: "aug", semitones: [0, 4, 8] },
  { id: "sus2", label: "sus 2", name: "suspended 2", tonal: "sus2", semitones: [0, 2, 7] },
  { id: "sus4", label: "sus 4", name: "suspended 4", tonal: "sus4", semitones: [0, 5, 7] },
  { id: "maj7", label: "maj 7", name: "major 7", tonal: "maj7", semitones: [0, 4, 7, 11] },
  { id: "dom7", label: "dom 7", name: "dominant 7", tonal: "7", semitones: [0, 4, 7, 10] },
  { id: "m7", label: "min 7", name: "minor 7", tonal: "m7", semitones: [0, 3, 7, 10] },
  { id: "m7b5", label: "half dim", name: "minor 7 flat 5", tonal: "m7b5", semitones: [0, 3, 6, 10] },
  { id: "dim7", label: "dim 7", name: "diminished 7", tonal: "dim7", semitones: [0, 3, 6, 9] },
  { id: "dom9", label: "dom 9", name: "dominant 9", tonal: "9", semitones: [0, 4, 7, 10, 14], optional: [2] },
  { id: "maj9", label: "maj 9", name: "major 9", tonal: "maj9", semitones: [0, 4, 7, 11, 14], optional: [2] },
  { id: "m9", label: "min 9", name: "minor 9", tonal: "m9", semitones: [0, 3, 7, 10, 14], optional: [2] },
  { id: "m11", label: "min 11", name: "minor 11", tonal: "m11", semitones: [0, 3, 7, 10, 14, 17], optional: [2] },
  // The 13 leaves out the 11th, as players usually do: it clashes with the major 3rd.
  { id: "dom13", label: "dom 13", name: "dominant 13", tonal: "13", semitones: [0, 4, 7, 10, 14, 21], optional: [2] },
];

export function chordQuality(id: string): ChordQuality {
  const q = CHORD_QUALITIES.find((c) => c.id === id);
  if (!q) throw new Error(`Unknown chord quality: ${id}`);
  return q;
}

/** How the notes are stacked. */
export type VoicingKind = "close" | "inversion" | "drop2" | "open" | "shell";

export interface Voicing {
  kind: VoicingKind;
  /** 0 = root position, 1 = 1st inversion (3rd in the bass), and so on. */
  inversion: number;
  /** Semitone offsets from the root, low to high. May be negative (root below). */
  offsets: number[];
}

/** Root position or an inversion, stacked as closely as possible. */
export function closeVoicing(q: ChordQuality, inversion = 0): Voicing {
  const s = [...q.semitones];
  const offsets = [...s.slice(inversion), ...s.slice(0, inversion).map((x) => x + 12)];
  return { kind: inversion === 0 ? "close" : "inversion", inversion, offsets };
}

/** Drop 2: the second note from the top of a close voicing moves down an octave. */
export function drop2Voicing(q: ChordQuality, inversion = 0): Voicing {
  const close = closeVoicing(q, inversion).offsets;
  const i = close.length - 2;
  const offsets = [...close.slice(0, i), close[i]! - 12, ...close.slice(i + 1)].sort((a, b) => a - b);
  // The bass changes: tell which chord tone is lowest now.
  const lowest = offsets[0]!;
  const bassTone = q.semitones.findIndex((x) => (((x - lowest) % 12) + 12) % 12 === 0);
  return { kind: "drop2", inversion: bassTone, offsets };
}

/** Extended chords: the root an octave below, the rest stacked above. */
export function openVoicing(q: ChordQuality): Voicing {
  return { kind: "open", inversion: 0, offsets: [q.semitones[0]! - 12, ...q.semitones.slice(1)] };
}

/** Extended chords: root below, then 3rd, 7th and extensions, leaving out a plain 5th. */
export function shellVoicing(q: ChordQuality): Voicing {
  const keep = q.semitones.filter((_, i) => i === 0 || !(q.optional ?? []).includes(i));
  return { kind: "shell", inversion: 0, offsets: [keep[0]! - 12, ...keep.slice(1)] };
}

export interface ChordSpelling {
  root: string;
  /** Note names in chord-tone order, root first. */
  notes: string[];
}

/** Spells a chord in any key with tonal, picking the easier enharmonic root (C# minor, not Db minor). */
export function spellQuality(root: string, q: ChordQuality): ChordSpelling {
  const r = readableRoot(root, (x) => Chord.get(`${x}${q.tonal}`).notes);
  const c = Chord.get(`${r}${q.tonal}`);
  if (c.empty) throw new Error(`tonal does not know ${r}${q.tonal}`);
  return { root: r, notes: plainNames(c.notes) };
}

const ORDINAL = ["root position", "1st inversion", "2nd inversion", "3rd inversion"];

/** "1st inversion", "drop 2 voicing", and so on, for the explanation after answering. */
export function voicingName(v: Voicing): string {
  switch (v.kind) {
    case "close":
      return "root position";
    case "inversion":
      return ORDINAL[v.inversion]!;
    case "drop2":
      return `drop 2 voicing${v.inversion > 0 ? `, ${ORDINAL[v.inversion]}` : ""}`;
    case "open":
      return "open voicing, root below";
    case "shell":
      return "shell voicing, no 5th";
  }
}
