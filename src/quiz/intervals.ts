// Intervals mode: hear two notes, name the interval.

import { KEYS } from "../theory/keys";
import { ALL_INTERVAL_IDS, INTERVALS, SIMPLE_INTERVAL_IDS, intervalDef, spellInterval } from "../theory/intervals";
import { noteChroma } from "../theory/spelling";
import type { Rng } from "./rng";
import type { AudioStep, Choice, LevelId, LevelRules, Question } from "./types";

export type Direction = "up" | "down" | "together";

export interface IntervalRules extends LevelRules {
  directions: readonly Direction[];
}

export const INTERVAL_LEVELS: Record<LevelId, IntervalRules> = {
  beginner: {
    mode: "intervals",
    level: "beginner",
    summary: "Minor 3rd, major 3rd, perfect 5th and octave, going up.",
    items: ["m3", "M3", "P5", "P8"],
    directions: ["up"],
    replays: Infinity,
    timeLimit: null,
  },
  intermediate: {
    mode: "intervals",
    level: "intermediate",
    summary: "Every interval within an octave, going up.",
    items: SIMPLE_INTERVAL_IDS,
    directions: ["up"],
    replays: Infinity,
    timeLimit: null,
  },
  professional: {
    mode: "intervals",
    level: "professional",
    summary: "Every interval within an octave: up, down and together.",
    items: SIMPLE_INTERVAL_IDS,
    directions: ["up", "down", "together"],
    replays: Infinity,
    timeLimit: null,
  },
  master: {
    mode: "intervals",
    level: "master",
    summary: "Up to two octaves, every direction, one replay, 8 seconds.",
    items: ALL_INTERVAL_IDS,
    directions: ["up", "down", "together"],
    replays: 1,
    timeLimit: 8,
  },
};

/** Lowest and highest notes used, so both sample sets sound good: A2 to A5. */
export const LOW_MIDI = 45;
export const HIGH_MIDI = 81;

const DIRECTION_TAG: Record<Direction, string> = { up: "Up", down: "Down", together: "Together" };

function choicesFor(items: readonly string[]): Choice[] {
  return INTERVALS.filter((i) => items.includes(i.id)).map((i) => ({ id: i.id, label: i.label, spoken: i.name }));
}

/** Notes 0.75 s apart, or both at once, from a low and a high MIDI note. */
export function intervalSound(low: number, high: number, dir: Direction): AudioStep[] {
  if (dir === "together") return [{ midis: [low, high], at: 0, dur: 1.8 }];
  const [first, second] = dir === "up" ? [low, high] : [high, low];
  return [
    { midis: [first], at: 0, dur: 0.9 },
    { midis: [second], at: 0.75, dur: 1.4 },
  ];
}

export function makeIntervalQuestion(level: LevelId, itemId: string, rng: Rng): Question {
  const rules = INTERVAL_LEVELS[level];
  const def = intervalDef(itemId);
  const dir = rules.directions[rng.int(rules.directions.length)]!;
  const keyName = KEYS[rng.int(KEYS.length)]!;
  const { low: lowName, high: highName } = spellInterval(keyName, def);

  // Pick an octave for the low note that keeps both notes in range.
  const chroma = noteChroma(lowName);
  const lows: number[] = [];
  for (let m = LOW_MIDI; m + def.semitones <= HIGH_MIDI; m++) if (((m % 12) + 12) % 12 === chroma) lows.push(m);
  const low = lows[rng.int(lows.length)]!;
  const high = low + def.semitones;

  const sound = intervalSound(low, high, dir);
  const explain =
    dir === "up" ? `${lowName} up to ${highName}` : dir === "down" ? `${highName} down to ${lowName}` : `${lowName} and ${highName} together`;

  return {
    mode: "intervals",
    level,
    itemId,
    prompt: "Name the interval",
    tag: rules.directions.length > 1 ? DIRECTION_TAG[dir] : undefined,
    sound,
    choices: choicesFor(rules.items),
    answer: itemId,
    reveal: sound,
    explain,
    compare: (id) => {
      const other = intervalDef(id);
      // Keep the first note heard the same, so the two sound like two answers to one question.
      if (dir === "down") return intervalSound(high - other.semitones, high, dir);
      return intervalSound(low, low + other.semitones, dir);
    },
    detail: { direction: dir, low, high, lowName, highName, semitones: def.semitones },
  };
}
