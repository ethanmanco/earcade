// XP, player levels and the daily streak. Pure functions over saved data,
// so they can be tested without a browser.

import type { LevelId, ModeId } from "../quiz/types";
import type { RoundRecord, TimerPref } from "./storage";

/** XP per right answer, by level. */
export const LEVEL_MULT: Record<LevelId, number> = { beginner: 1, intermediate: 1.5, professional: 2, master: 3 };
export const XP_PER_RIGHT = 10;
export const PERFECT_BONUS = 20;

/**
 * XP for one round: 10 per right answer, times the level's multiplier, plus
 * a bonus for a perfect round. Master with extra or no time counts a little
 * less (2.5 instead of 3), since the time limit is part of Master.
 */
export function xpForRound(r: Pick<RoundRecord, "level" | "score" | "total"> & { timer?: TimerPref }): number {
  const mult = r.level === "master" && r.timer && r.timer !== "normal" ? 2.5 : LEVEL_MULT[r.level];
  const bonus = r.total > 0 && r.score === r.total ? PERFECT_BONUS : 0;
  return Math.round((r.score * XP_PER_RIGHT + bonus) * mult);
}

/** XP needed to reach a player level: 0 for level 1, then 100, 300, 600, 1000... */
export function xpForLevel(level: number): number {
  return (100 * (level - 1) * level) / 2;
}

export interface PlayerLevel {
  level: number;
  /** XP earned since this level began. */
  into: number;
  /** XP this level takes in all. */
  span: number;
}

export function playerLevel(xp: number): PlayerLevel {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const start = xpForLevel(level);
  return { level, into: xp - start, span: xpForLevel(level + 1) - start };
}

// ---------------------------------------------------------------- streak

export interface Streak {
  /** Days in a row with at least one finished round, ending on lastDay. */
  current: number;
  best: number;
  /** Local date of the last finished round, "YYYY-MM-DD", or null. */
  lastDay: string | null;
}

export function emptyStreak(): Streak {
  return { current: 0, best: 0, lastDay: null };
}

/** The local calendar day, "YYYY-MM-DD". */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whole days from day a to day b (b later is positive). */
export function daysBetween(a: string, b: string): number {
  const t = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y!, m! - 1, d!);
  };
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** The streak after finishing a round today. */
export function bumpStreak(s: Streak, today: string): Streak {
  if (s.lastDay === today) return s;
  const gap = s.lastDay ? daysBetween(s.lastDay, today) : Infinity;
  const current = gap === 1 ? s.current + 1 : 1;
  return { current, best: Math.max(s.best, current), lastDay: today };
}

export interface StreakView {
  /** The streak as it stands today: 0 once a whole day has been missed. */
  days: number;
  best: number;
  /** True when today's round is still to play to keep the streak going. */
  playToday: boolean;
}

export function streakToday(s: Streak, today: string): StreakView {
  if (!s.lastDay) return { days: 0, best: s.best, playToday: true };
  const gap = daysBetween(s.lastDay, today);
  if (gap <= 0) return { days: s.current, best: s.best, playToday: false };
  if (gap === 1) return { days: s.current, best: s.best, playToday: true };
  return { days: 0, best: s.best, playToday: true };
}

// ---------------------------------------------------------------- stats

export interface LevelStats {
  mode: ModeId;
  level: LevelId;
  rounds: number;
  /** Right answers over questions, 0 to 1, or null with no rounds. */
  accuracy: number | null;
  best: number | null;
  /** The latest rounds, oldest first, as fractions right. */
  recent: number[];
  /** Accuracy of the newer half of `recent` minus the older half (needs 4 or more rounds). */
  trend: number | null;
}

export function levelStats(rounds: readonly RoundRecord[], mode: ModeId, level: LevelId, recentCount = 10): LevelStats {
  const mine = rounds.filter((r) => r.mode === mode && r.level === level && r.total > 0);
  const right = mine.reduce((n, r) => n + r.score, 0);
  const asked = mine.reduce((n, r) => n + r.total, 0);
  const recent = mine.slice(-recentCount).map((r) => r.score / r.total);
  let trend: number | null = null;
  if (recent.length >= 4) {
    const half = Math.floor(recent.length / 2);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    trend = avg(recent.slice(recent.length - half)) - avg(recent.slice(0, half));
  }
  return {
    mode,
    level,
    rounds: mine.length,
    accuracy: asked ? right / asked : null,
    best: mine.length ? Math.max(...mine.map((r) => r.score / r.total)) : null,
    recent,
    trend,
  };
}

export interface ItemStat {
  key: string;
  mode: ModeId;
  level: LevelId;
  itemId: string;
  right: number;
  total: number;
}

/** Items with the lowest recent accuracy (at least `min` tries), weakest first. */
export function weakestItems(history: Record<string, boolean[]>, count = 5, min = 3): ItemStat[] {
  const out: ItemStat[] = [];
  for (const [key, h] of Object.entries(history)) {
    if (h.length < min) continue;
    const [mode, level, ...rest] = key.split("/");
    const right = h.filter(Boolean).length;
    if (right === h.length) continue;
    out.push({ key, mode: mode as ModeId, level: level as LevelId, itemId: rest.join("/"), right, total: h.length });
  }
  return out.sort((a, b) => a.right / a.total - b.right / b.total || b.total - a.total).slice(0, count);
}
