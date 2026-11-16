// Picks which items a round asks. Items you miss come up more often in later
// rounds; items you have not tried yet get a small boost so they show up early.

import type { Rng } from "./rng";
import type { ItemHistory } from "./types";

/** How many recent answers per item are remembered. */
export const HISTORY_LENGTH = 20;

/** Weight of an item: 1 when always right, up to 4 when always wrong, 1.5 when never tried. */
export function itemWeight(history: readonly boolean[] | undefined): number {
  if (!history || history.length === 0) return 1.5;
  const misses = history.filter((ok) => !ok).length;
  return 1 + (3 * misses) / history.length;
}

/**
 * Chooses `count` items by weight. No item comes up more than `cap` times
 * (3, or more when the pool is too small to fill a round), and the same item
 * never comes up three times in a row.
 */
export function pickItems(items: readonly string[], history: ItemHistory, rng: Rng, count = 10): string[] {
  if (items.length === 0) throw new Error("No items to pick from");
  const cap = Math.max(3, Math.ceil(count / items.length));
  const used = new Map<string, number>();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const lastTwoSame = out.length >= 2 && out[out.length - 1] === out[out.length - 2] ? out[out.length - 1] : null;
    let pool = items.filter((id) => (used.get(id) ?? 0) < cap && id !== lastTwoSame);
    if (pool.length === 0) pool = items.filter((id) => id !== lastTwoSame);
    if (pool.length === 0) pool = [...items];
    const weights = pool.map((id) => itemWeight(history[id]));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng.next() * total;
    let pick = pool[pool.length - 1]!;
    for (let k = 0; k < pool.length; k++) {
      r -= weights[k]!;
      if (r < 0) {
        pick = pool[k]!;
        break;
      }
    }
    out.push(pick);
    used.set(pick, (used.get(pick) ?? 0) + 1);
  }
  return out;
}

/** One item by weight, leaving out `except` when there is anything else to pick. */
export function pickOne(items: readonly string[], history: ItemHistory, rng: Rng, except?: string): string {
  const pool = items.filter((id) => id !== except);
  const from = pool.length ? pool : [...items];
  const weights = from.map((id) => itemWeight(history[id]));
  let r = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < from.length; k++) {
    r -= weights[k]!;
    if (r < 0) return from[k]!;
  }
  return from[from.length - 1]!;
}

/** Adds one result to an item's history, keeping the most recent HISTORY_LENGTH. */
export function recordResult(history: ItemHistory, itemId: string, correct: boolean): void {
  const h = (history[itemId] ??= []);
  h.push(correct);
  if (h.length > HISTORY_LENGTH) h.splice(0, h.length - HISTORY_LENGTH);
}
