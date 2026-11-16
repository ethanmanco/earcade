// Scale degrees mode: hear a progression that sets the key, then a note
// (or two at Master); name the scale degree.

import {
  ALL_DEGREES,
  DEGREES,
  MAJOR_DEGREES,
  MAJOR_TONICS,
  MINOR_TONICS,
  cadence,
  degreeDef,
  keyName,
  spellDegree,
  type KeyChoice,
} from "../theory/degrees";
import { noteChroma } from "../theory/spelling";
import { pickOne } from "./adaptive";
import type { Rng } from "./rng";
import type { AudioStep, Choice, LevelId, LevelRules, Question, RoundContext } from "./types";

export interface DegreeRules extends LevelRules {
  modes: readonly ("major" | "minor")[];
  /** A new key for every question (Master) instead of one per round. */
  keyEachQuestion: boolean;
  /** Notes per question. */
  notes: 1 | 2;
  /** The key-setting progression plays only on the first play. */
  contextOnce: boolean;
}

export const DEGREE_LEVELS: Record<LevelId, DegreeRules> = {
  beginner: {
    mode: "degrees",
    level: "beginner",
    summary: "Degrees 1, 3 and 5 in major keys.",
    items: ["1", "3", "5"],
    modes: ["major"],
    keyEachQuestion: false,
    notes: 1,
    contextOnce: false,
    replays: Infinity,
    timeLimit: null,
  },
  intermediate: {
    mode: "degrees",
    level: "intermediate",
    summary: "All 7 degrees in major keys.",
    items: [...MAJOR_DEGREES],
    modes: ["major"],
    keyEachQuestion: false,
    notes: 1,
    contextOnce: false,
    replays: Infinity,
    timeLimit: null,
  },
  professional: {
    mode: "degrees",
    level: "professional",
    summary: "Major and minor keys, with all 12 notes, chromatic ones too.",
    items: ALL_DEGREES,
    modes: ["major", "minor"],
    keyEachQuestion: false,
    notes: 1,
    contextOnce: false,
    replays: Infinity,
    timeLimit: null,
  },
  master: {
    mode: "degrees",
    level: "master",
    summary: "A new key each time, two-note phrases, the key plays once. One replay of the notes.",
    items: ALL_DEGREES,
    modes: ["major", "minor"],
    keyEachQuestion: true,
    notes: 2,
    contextOnce: true,
    replays: 1,
    timeLimit: null,
  },
};

/** The tonic sits between G3 and F#4, so the progression and the notes stay mid-range. */
export const TONIC_LOW = 55;
export const TONIC_HIGH = 66;

const CHORD_GAP = 0.65;
const NOTE_START = 4 * CHORD_GAP + 0.5;
const NOTE_GAP = 0.8;

export function pickKey(rules: DegreeRules, rng: Rng): KeyChoice {
  const mode = rules.modes[rng.int(rules.modes.length)]!;
  const tonics = mode === "major" ? MAJOR_TONICS : MINOR_TONICS;
  return { tonic: tonics[rng.int(tonics.length)]!, mode };
}

/** A context for a round: Scale degrees keeps one key for the whole round below Master. */
export function degreeRoundKey(level: LevelId, rng: Rng): KeyChoice {
  return pickKey(DEGREE_LEVELS[level], rng);
}

function tonicMidi(tonic: string): number {
  const c = noteChroma(tonic);
  for (let m = TONIC_LOW; m <= TONIC_HIGH; m++) if (m % 12 === c) return m;
  throw new Error(`No tonic in range for ${tonic}`);
}

function cadenceSteps(tonic: number, key: KeyChoice): AudioStep[] {
  return cadence(key.mode).map((chord, i) => ({
    midis: chord.map((o) => tonic + o),
    at: i * CHORD_GAP,
    dur: i === 3 ? 1 : CHORD_GAP,
  }));
}

function notesSteps(midis: readonly number[], start: number): AudioStep[] {
  return midis.map((m, i) => ({ midis: [m], at: start + i * NOTE_GAP, dur: i === midis.length - 1 ? 1.5 : NOTE_GAP + 0.1 }));
}

/** The note for a degree: above the tonic, with 1 sometimes an octave up. */
function degreeMidi(tonic: number, id: string, rng: Rng): number {
  const s = degreeDef(id).semitones;
  return tonic + s + (s === 0 && rng.next() < 0.5 ? 12 : 0);
}

function choicesFor(items: readonly string[]): Choice[] {
  return DEGREES.filter((d) => items.includes(d.id)).map((d) => ({ id: d.id, label: d.id, spoken: d.name, sub: d.name.replace(/^\d+, /, "") }));
}

export function makeDegreeQuestion(level: LevelId, itemId: string, rng: Rng, ctx: RoundContext): Question {
  const rules = DEGREE_LEVELS[level];
  const key = rules.keyEachQuestion || !ctx.key ? pickKey(rules, rng) : ctx.key;
  const tonic = tonicMidi(key.tonic);
  const parts = rules.notes === 2 ? [itemId, pickOne(rules.items, ctx.history, rng, itemId)] : [itemId];
  const midis = parts.map((id) => degreeMidi(tonic, id, rng));

  const sound = [...cadenceSteps(tonic, key), ...notesSteps(midis, NOTE_START)];
  const tonicChord = { midis: cadence(key.mode)[0]!.map((o) => tonic + o), at: 0, dur: 0.9 };
  const reveal = [tonicChord, ...notesSteps(midis, 1.1)];
  const names = parts.map((id) => spellDegree(key.tonic, id, key.mode));
  const explain =
    parts.length === 1
      ? `In ${keyName(key)}, ${names[0]} is ${parts[0]}`
      : `In ${keyName(key)}: ${names.join(" then ")}, ${parts.join(" then ")}`;

  return {
    mode: "degrees",
    level,
    itemId,
    prompt: parts.length === 1 ? "Name the scale degree" : "Name both degrees, in order",
    tag: keyName(key),
    sound,
    replay: rules.contextOnce ? notesSteps(midis, 0) : undefined,
    parts: parts.length > 1 ? parts : undefined,
    choices: choicesFor(rules.items),
    answer: parts.join(" "),
    reveal,
    explain,
    // Your pick, played the same way: the tonic chord, then the note(s) you named.
    compare: (choice) => {
      const ids = choice.split(" ");
      return [tonicChord, ...notesSteps(ids.map((id) => tonic + degreeDef(id).semitones), 1.1)];
    },
    detail: { tonic, tonicName: key.tonic, keyMode: key.mode, midis, names: names.join(" ") },
  };
}
