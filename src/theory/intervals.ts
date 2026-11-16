// Intervals from a minor 2nd up to a double octave, and how to spell them in
// any key. Pure theory: no sound, no screen.

import { Interval, Note } from "tonal";

export interface IntervalDef {
  /** Short id, e.g. "m3", "TT", "P15". */
  id: string;
  /**
   * Button text, e.g. "min 3". The pixel font has capitals only, so "m3" and
   * "M3" would look the same; these labels never clash.
   */
  label: string;
  /** Size in semitones (1 to 24). */
  semitones: number;
  /** Name read aloud and shown under the button, e.g. "minor 3rd". */
  name: string;
  /** The interval as tonal writes it, used to spell the top note. */
  tonal: string;
}

export const INTERVALS: readonly IntervalDef[] = [
  { id: "m2", label: "min 2", semitones: 1, name: "minor 2nd", tonal: "2m" },
  { id: "M2", label: "maj 2", semitones: 2, name: "major 2nd", tonal: "2M" },
  { id: "m3", label: "min 3", semitones: 3, name: "minor 3rd", tonal: "3m" },
  { id: "M3", label: "maj 3", semitones: 4, name: "major 3rd", tonal: "3M" },
  { id: "P4", label: "P4", semitones: 5, name: "perfect 4th", tonal: "4P" },
  { id: "TT", label: "TT", semitones: 6, name: "tritone", tonal: "4A" },
  { id: "P5", label: "P5", semitones: 7, name: "perfect 5th", tonal: "5P" },
  { id: "m6", label: "min 6", semitones: 8, name: "minor 6th", tonal: "6m" },
  { id: "M6", label: "maj 6", semitones: 9, name: "major 6th", tonal: "6M" },
  { id: "m7", label: "min 7", semitones: 10, name: "minor 7th", tonal: "7m" },
  { id: "M7", label: "maj 7", semitones: 11, name: "major 7th", tonal: "7M" },
  { id: "P8", label: "8ve", semitones: 12, name: "octave", tonal: "8P" },
  { id: "m9", label: "min 9", semitones: 13, name: "minor 9th", tonal: "9m" },
  { id: "M9", label: "maj 9", semitones: 14, name: "major 9th", tonal: "9M" },
  { id: "m10", label: "min 10", semitones: 15, name: "minor 10th", tonal: "10m" },
  { id: "M10", label: "maj 10", semitones: 16, name: "major 10th", tonal: "10M" },
  { id: "P11", label: "P11", semitones: 17, name: "perfect 11th", tonal: "11P" },
  { id: "A11", label: "aug 11", semitones: 18, name: "augmented 11th", tonal: "11A" },
  { id: "P12", label: "P12", semitones: 19, name: "perfect 12th", tonal: "12P" },
  { id: "m13", label: "min 13", semitones: 20, name: "minor 13th", tonal: "13m" },
  { id: "M13", label: "maj 13", semitones: 21, name: "major 13th", tonal: "13M" },
  { id: "m14", label: "min 14", semitones: 22, name: "minor 14th", tonal: "14m" },
  { id: "M14", label: "maj 14", semitones: 23, name: "major 14th", tonal: "14M" },
  { id: "P15", label: "2 8ve", semitones: 24, name: "double octave", tonal: "15P" },
];

export function intervalDef(id: string): IntervalDef {
  const d = INTERVALS.find((i) => i.id === id);
  if (!d) throw new Error(`Unknown interval: ${id}`);
  return d;
}

/** Interval ids within one octave, m2 to P8. */
export const SIMPLE_INTERVAL_IDS: readonly string[] = INTERVALS.filter((i) => i.semitones <= 12).map((i) => i.id);
/** Every interval id, m2 to P15. */
export const ALL_INTERVAL_IDS: readonly string[] = INTERVALS.map((i) => i.id);

const DOUBLE = /bb|##/;

/**
 * Spells the note an interval above `root` (a pitch class such as "Db").
 * If that would need a double sharp or flat, the root is respelled (Db up a
 * minor 2nd is written C# to D, not Db to Ebb). Returns both names.
 */
export function spellInterval(root: string, def: IntervalDef): { low: string; high: string } {
  const tryRoot = (r: string) => ({ low: r, high: Note.pitchClass(Note.transpose(`${r}4`, def.tonal)) });
  const first = tryRoot(root);
  if (!DOUBLE.test(first.high)) return first;
  const alt = Note.enharmonic(root);
  if (alt && alt !== root) {
    const second = tryRoot(alt);
    if (!DOUBLE.test(second.high)) return second;
  }
  return first;
}

/** Size of a tonal interval name in semitones, for tests and checks. */
export function semitonesOf(tonal: string): number {
  return Interval.semitones(tonal) ?? NaN;
}
