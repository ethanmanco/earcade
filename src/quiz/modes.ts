// Every mode in one place: its name, its levels and its question maker.

import { INTERVAL_LEVELS, makeIntervalQuestion } from "./intervals";
import type { Rng } from "./rng";
import type { LevelId, LevelRules, ModeId, Question } from "./types";

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
  { id: "chords", name: "Chords", blurb: "Hear a chord, name its quality.", ready: false },
  { id: "degrees", name: "Scale degrees", blurb: "Hear a key, then name the note.", ready: false },
  { id: "fretboard", name: "Fretboard", blurb: "See a note, find it on the neck.", ready: false },
];

export function modeInfo(id: ModeId): ModeInfo {
  return MODES.find((m) => m.id === id)!;
}

export function modeRules(mode: ModeId, level: LevelId): LevelRules {
  switch (mode) {
    case "intervals":
      return INTERVAL_LEVELS[level];
    default:
      throw new Error(`${mode} is not built yet`);
  }
}

export function makeQuestion(mode: ModeId, level: LevelId, itemId: string, rng: Rng): Question {
  switch (mode) {
    case "intervals":
      return makeIntervalQuestion(level, itemId, rng);
    default:
      throw new Error(`${mode} is not built yet`);
  }
}
