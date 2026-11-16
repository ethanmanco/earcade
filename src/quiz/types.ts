// The question data model shared by every mode. The quiz code builds these;
// the screen and the sound only read them.

export type ModeId = "intervals" | "chords" | "degrees" | "fretboard";
export type LevelId = "beginner" | "intermediate" | "professional" | "master";

export const LEVEL_IDS: readonly LevelId[] = ["beginner", "intermediate", "professional", "master"];

export const LEVEL_NAMES: Record<LevelId, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  professional: "Professional",
  master: "Master",
};

/** One sound event: these MIDI notes start `at` seconds into the clip and last `dur` seconds. */
export interface AudioStep {
  midis: number[];
  at: number;
  dur: number;
}

export interface Choice {
  /** Matches an item id, e.g. "P5". */
  id: string;
  /** Big button text, e.g. "P5". */
  label: string;
  /** Read aloud and shown small under the label, e.g. "perfect 5th". */
  spoken: string;
  /** Shown small under the label instead of `spoken`, when that would repeat the label. */
  sub?: string;
}

export interface Question {
  mode: ModeId;
  level: LevelId;
  /** What this question tests; drives adaptivity and the per-item results. */
  itemId: string;
  /** Short instruction, e.g. "Name the interval". */
  prompt: string;
  /** A tag shown with the prompt, e.g. "Up", "Down" or "Together". */
  tag?: string;
  /** What plays when the player taps Play. */
  sound: AudioStep[];
  /** What a replay plays, when it differs (Scale degrees Master: the note again, not the key). */
  replay?: AudioStep[];
  /**
   * For questions answered with more than one pick (two-note phrases): the
   * item id of each pick, in order. The answer is these ids joined by spaces.
   */
  parts?: string[];
  choices: Choice[];
  /** The id of the right choice. */
  answer: string;
  /**
   * When several picks count as right (any spot on the neck that plays the
   * note), their ids. Otherwise only `answer` is right.
   */
  accept?: string[];
  /** Fretboard questions: answered by tapping the neck instead of buttons. */
  board?: { strings: number[]; frets: [number, number]; note: string };
  /** Plays after answering, so the ear hears the right answer once more. */
  reveal: AudioStep[];
  /** What it was, in words, e.g. "C up to G". */
  explain: string;
  /**
   * Builds the sound of another choice from the same starting note, so a wrong
   * answer can be compared with the right one.
   */
  compare?: (choiceId: string) => AudioStep[];
  /** Facts the tests check: notes, direction, and so on. */
  detail: Record<string, string | number | number[]>;
}

/** What each level allows and how it plays. */
export interface LevelRules {
  mode: ModeId;
  level: LevelId;
  /** One line for the level picker. */
  summary: string;
  /** The answer pool. */
  items: readonly string[];
  /** Replays allowed after the first play. */
  replays: number;
  /** Seconds to answer once the sound ends, or null for no limit. */
  timeLimit: number | null;
}

/** Recent results per item, newest last, true = right. */
export type ItemHistory = Record<string, boolean[]>;

/** Shared by every question in a round: the player's history, and anything a mode keeps for the round (a key). */
export interface RoundContext {
  history: ItemHistory;
  key?: { tonic: string; mode: "major" | "minor" };
}
