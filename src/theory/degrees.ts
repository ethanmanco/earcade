// Scale degrees in major and minor keys, the progressions that set a key,
// and how each degree is spelled. Pure theory: no sound, no screen.
//
// Degrees are always named against the major scale (b3, b6, b7), so a label
// means the same sound in a major key and a minor key.

import { Note } from "tonal";

export interface DegreeDef {
  /** Item id and button text: "1", "b3", "#4". */
  id: string;
  semitones: number;
  /** Read aloud and shown small: "3, mediant", "flat 3". */
  name: string;
  /** Interval from the tonic, as tonal writes it. */
  tonal: string;
}

export const DEGREES: readonly DegreeDef[] = [
  { id: "1", semitones: 0, name: "1, tonic", tonal: "1P" },
  { id: "b2", semitones: 1, name: "flat 2", tonal: "2m" },
  { id: "2", semitones: 2, name: "2, supertonic", tonal: "2M" },
  { id: "b3", semitones: 3, name: "flat 3", tonal: "3m" },
  { id: "3", semitones: 4, name: "3, mediant", tonal: "3M" },
  { id: "4", semitones: 5, name: "4, subdominant", tonal: "4P" },
  { id: "#4", semitones: 6, name: "sharp 4", tonal: "4A" },
  { id: "5", semitones: 7, name: "5, dominant", tonal: "5P" },
  { id: "b6", semitones: 8, name: "flat 6", tonal: "6m" },
  { id: "6", semitones: 9, name: "6, submediant", tonal: "6M" },
  { id: "b7", semitones: 10, name: "flat 7", tonal: "7m" },
  { id: "7", semitones: 11, name: "7, leading tone", tonal: "7M" },
];

export const MAJOR_DEGREES = ["1", "2", "3", "4", "5", "6", "7"] as const;
export const MINOR_DEGREES = ["1", "2", "b3", "4", "5", "b6", "b7"] as const;
export const ALL_DEGREES: readonly string[] = DEGREES.map((d) => d.id);

export function degreeDef(id: string): DegreeDef {
  const d = DEGREES.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown degree: ${id}`);
  return d;
}

export type Mode = "major" | "minor";

export interface KeyChoice {
  tonic: string;
  mode: Mode;
}

/** Tonics as usually written: Db major but C# minor, and so on. */
export const MAJOR_TONICS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;
export const MINOR_TONICS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"] as const;

export function keyName(k: KeyChoice): string {
  return `${k.tonic} ${k.mode}`;
}

/**
 * The degree's note name in a key. Never a double sharp or flat; and a note
 * outside the key's own scale skips Fb, Cb, E# and B# too (E, not Fb, as the
 * flat 6 of Ab major), since those spellings only help inside the key.
 */
export function spellDegree(tonic: string, id: string, mode: Mode = "major"): string {
  const n = Note.pitchClass(Note.transpose(tonic, degreeDef(id).tonal));
  const own: readonly string[] = mode === "major" ? MAJOR_DEGREES : MINOR_DEGREES;
  const odd = own.includes(id) ? /bb|##/ : /bb|##|^(Fb|Cb|E#|B#)$/;
  return odd.test(n) ? Note.enharmonic(n) : n;
}

/**
 * Chords that set the key, as semitone offsets from the tonic: I IV V I in
 * major, i iv V i in minor (with the major V of harmonic minor, as most
 * music does). Bass note first, then three upper voices close together.
 */
export function cadence(mode: Mode): number[][] {
  const third = mode === "major" ? 4 : 3;
  const sixth = mode === "major" ? 9 : 8;
  return [
    [-12, 0, third, 7],
    [-7, 0, 5, sixth],
    [-5, -1, 2, 7],
    [-12, 0, third, 7],
  ];
}
