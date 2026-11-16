// Every mode in one place: its name, its levels and its question maker.

import { CHORD_LEVELS, makeChordQuestion } from "./chords";
import { DEGREE_LEVELS, degreeRoundKey, makeDegreeQuestion } from "./degrees";
import { INTERVAL_LEVELS, makeIntervalQuestion } from "./intervals";
import type { Rng } from "./rng";
import type { ItemHistory, LevelId, LevelRules, ModeId, Question, RoundContext } from "./types";

export interface ModeInfo {
  id: ModeId;
  name: string;
  /** One line for the home screen. */
  blurb: string;
  /** False until the mode is built. */
  ready: boolean;
}

export const MODES: readonly ModeInfo[] = [
  { id: "intervals", name: "Intervals", blurb: "Hear two notes, name the gap.", ready: true },
  { id: "chords", name: "Chords", blurb: "Hear a chord, name its quality.", ready: true },
  { id: "degrees", name: "Scale degrees", blurb: "Hear a key, then name the note.", ready: true },
  { id: "fretboard", name: "Fretboard", blurb: "See a note, find it on the neck.", ready: false },
];

export function modeInfo(id: ModeId): ModeInfo {
  return MODES.find((m) => m.id === id)!;
}

export function modeRules(mode: ModeId, level: LevelId): LevelRules {
  switch (mode) {
    case "intervals":
      return INTERVAL_LEVELS[level];
    case "chords":
      return CHORD_LEVELS[level];
    case "degrees":
      return DEGREE_LEVELS[level];
    default:
      throw new Error(`${mode} is not built yet`);
  }
}

/** What a round shares between its questions. */
export function roundContext(mode: ModeId, level: LevelId, history: ItemHistory, rng: Rng): RoundContext {
  return mode === "degrees" ? { history, key: degreeRoundKey(level, rng) } : { history };
}

export function makeQuestion(mode: ModeId, level: LevelId, itemId: string, rng: Rng, ctx: RoundContext = { history: {} }): Question {
  switch (mode) {
    case "intervals":
      return makeIntervalQuestion(level, itemId, rng);
    case "chords":
      return makeChordQuestion(level, itemId, rng);
    case "degrees":
      return makeDegreeQuestion(level, itemId, rng, ctx);
    default:
      throw new Error(`${mode} is not built yet`);
  }
}
