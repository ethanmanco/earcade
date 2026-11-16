// Settings, item history and round results, kept in this browser. Every read
// and write is wrapped in try/catch (as in Pocket Pixels): private browsing or
// blocked storage just means nothing is remembered, and the game still works.

import { HISTORY_LENGTH } from "../quiz/adaptive";
import { LEVEL_IDS, type ItemHistory, type LevelId, type ModeId } from "../quiz/types";
import { emptyStreak, type Streak } from "./progress";

export type MotionPref = "system" | "reduce" | "full";
export type TimerPref = "normal" | "double" | "off";

export interface Settings {
  instrument: "piano" | "guitar";
  /** 0 to 1. */
  volume: number;
  motion: MotionPref;
  /** Play each question as soon as it appears. Screen reader users may prefer off, so speech and notes do not overlap. */
  autoplay: boolean;
  /** Master time limits: as designed, doubled, or off. */
  timer: TimerPref;
  /** Chiptune blips for right, wrong and round end. */
  gameSounds: boolean;
}

export interface RoundRecord {
  /** Time the round ended, ms since 1970. */
  at: number;
  mode: ModeId;
  level: LevelId;
  score: number;
  total: number;
  /** Per item: [right, total]. */
  items: Record<string, [number, number]>;
  /** The Master timer setting used, when not "normal". */
  timer?: TimerPref;
}

export interface Saved {
  settings: Settings;
  /** Recent results per "mode/level/item". */
  history: ItemHistory;
  /** Most recent last, capped. */
  rounds: RoundRecord[];
  /** Last level played per mode. */
  lastLevel: Partial<Record<ModeId, LevelId>>;
  /** All XP earned (kept apart from rounds, which are capped). */
  xp: number;
  streak: Streak;
}

const KEY = "earcade:v1";
export const MAX_ROUNDS = 500;
const MODE_IDS: readonly ModeId[] = ["intervals", "chords", "degrees", "fretboard"];

export function defaultSettings(): Settings {
  return { instrument: "piano", volume: 0.8, motion: "system", autoplay: true, timer: "normal", gameSounds: true };
}

export function defaults(): Saved {
  return { settings: defaultSettings(), history: {}, rounds: [], lastLevel: {}, xp: 0, streak: emptyStreak() };
}

const isMode = (v: unknown): v is ModeId => MODE_IDS.includes(v as ModeId);
const isLevel = (v: unknown): v is LevelId => LEVEL_IDS.includes(v as LevelId);
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

function cleanSettings(v: unknown): Settings {
  const d = defaultSettings();
  if (!v || typeof v !== "object") return d;
  const s = v as Partial<Settings>;
  return {
    instrument: s.instrument === "guitar" ? "guitar" : "piano",
    volume: typeof s.volume === "number" && s.volume >= 0 && s.volume <= 1 ? s.volume : d.volume,
    motion: s.motion === "reduce" || s.motion === "full" ? s.motion : "system",
    autoplay: typeof s.autoplay === "boolean" ? s.autoplay : d.autoplay,
    timer: s.timer === "double" || s.timer === "off" ? s.timer : "normal",
    gameSounds: typeof s.gameSounds === "boolean" ? s.gameSounds : d.gameSounds,
  };
}

function cleanRound(v: unknown): RoundRecord | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Partial<RoundRecord>;
  const at = count(r.at);
  const score = count(r.score);
  const total = count(r.total);
  if (at === null || score === null || total === null || score > total || !isMode(r.mode) || !isLevel(r.level)) return null;
  const items: Record<string, [number, number]> = {};
  if (r.items && typeof r.items === "object") {
    for (const [id, pair] of Object.entries(r.items)) {
      if (Array.isArray(pair) && pair.length === 2) {
        const [a, b] = [count(pair[0]), count(pair[1])];
        if (a !== null && b !== null && a <= b) items[id.slice(0, 40)] = [a, b];
      }
    }
  }
  const rec: RoundRecord = { at, mode: r.mode, level: r.level, score, total, items };
  if (r.timer === "double" || r.timer === "off") rec.timer = r.timer;
  return rec;
}

/** Reads saved data, falling back to defaults for anything missing or broken. */
export function load(storage: Pick<Storage, "getItem"> | null = safeStorage()): Saved {
  const d = defaults();
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return d;
    const v = JSON.parse(raw) as Partial<Saved>;
    const history: ItemHistory = {};
    if (v.history && typeof v.history === "object") {
      for (const [k, h] of Object.entries(v.history)) {
        if (Array.isArray(h)) history[k.slice(0, 80)] = h.filter((x): x is boolean => typeof x === "boolean").slice(-HISTORY_LENGTH);
      }
    }
    const lastLevel: Saved["lastLevel"] = {};
    if (v.lastLevel && typeof v.lastLevel === "object") {
      for (const [m, l] of Object.entries(v.lastLevel)) if (isMode(m) && isLevel(l)) lastLevel[m] = l;
    }
    const st = (v.streak ?? {}) as Partial<Streak>;
    const current = count(st.current) ?? 0;
    const lastDay = typeof st.lastDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(st.lastDay) ? st.lastDay : null;
    return {
      xp: count(v.xp) ?? 0,
      streak: { current: lastDay ? current : 0, best: Math.max(count(st.best) ?? 0, lastDay ? current : 0), lastDay },
      settings: cleanSettings(v.settings),
      history,
      rounds: Array.isArray(v.rounds) ? v.rounds.map(cleanRound).filter((r): r is RoundRecord => r !== null).slice(-MAX_ROUNDS) : [],
      lastLevel,
    };
  } catch {
    return d;
  }
}

export function save(data: Saved, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: keep playing without saving.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Key for an item's history: history is kept per mode and level. */
export function historyKey(mode: ModeId, level: LevelId, itemId: string): string {
  return `${mode}/${level}/${itemId}`;
}

/** The history of one mode and level, keyed by item id, as the quiz wants it. */
export function historyFor(saved: Saved, mode: ModeId, level: LevelId): ItemHistory {
  const prefix = `${mode}/${level}/`;
  const out: ItemHistory = {};
  for (const [k, h] of Object.entries(saved.history)) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = h;
  return out;
}

/**
 * The level to suggest next: one up from `level` after a round of 9/10 or
 * better, or two rounds in a row of 8/10 or better at that level.
 */
export function suggestNext(rounds: readonly RoundRecord[], mode: ModeId, level: LevelId): LevelId | null {
  const i = LEVEL_IDS.indexOf(level);
  if (i === LEVEL_IDS.length - 1) return null;
  const mine = rounds.filter((r) => r.mode === mode && r.level === level && r.total > 0);
  const last = mine[mine.length - 1];
  const prev = mine[mine.length - 2];
  if (!last) return null;
  const pct = (r: RoundRecord) => r.score / r.total;
  if (pct(last) >= 0.9 || (prev && pct(last) >= 0.8 && pct(prev) >= 0.8)) return LEVEL_IDS[i + 1]!;
  return null;
}
