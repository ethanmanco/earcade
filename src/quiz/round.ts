// A round: 10 questions, the answers given, and the summary at the end.
// No screen and no sound here, so it can be tested directly.

import { pickItems } from "./adaptive";
import { makeQuestion, modeRules, roundContext } from "./modes";
import type { Rng } from "./rng";
import type { ItemHistory, LevelId, ModeId, Question } from "./types";

export const ROUND_LENGTH = 10;

/** One item's result inside an answer (a two-note phrase has two). */
export interface PartResult {
  itemId: string;
  correct: boolean;
}

export interface Answer {
  itemId: string;
  /** Choice id picked (ids joined by spaces for several picks), or null when time ran out. */
  chosen: string | null;
  /** Right only when every pick is right. */
  correct: boolean;
  parts: PartResult[];
}

export interface ItemScore {
  itemId: string;
  label: string;
  spoken: string;
  right: number;
  total: number;
}

export interface RoundSummary {
  mode: ModeId;
  level: LevelId;
  score: number;
  total: number;
  /** Every item asked, in the order of the answer pool. */
  items: ItemScore[];
  /** Items with at least one miss, weakest first. */
  practice: ItemScore[];
}

/** The item ids a question asks, one per pick. */
export function partsOf(q: Question): string[] {
  return q.parts ?? [q.answer];
}

export class Round {
  readonly questions: Question[];
  readonly answers: Answer[] = [];

  constructor(
    readonly mode: ModeId,
    readonly level: LevelId,
    history: ItemHistory,
    rng: Rng,
  ) {
    const rules = modeRules(mode, level);
    const ctx = roundContext(mode, level, history, rng);
    this.questions = pickItems(rules.items, history, rng, ROUND_LENGTH).map((id) => makeQuestion(mode, level, id, rng, ctx));
  }

  get index(): number {
    return this.answers.length;
  }

  get current(): Question | null {
    return this.questions[this.index] ?? null;
  }

  get done(): boolean {
    return this.answers.length >= this.questions.length;
  }

  /** Answers the current question. Pass null when the time ran out. */
  answer(choiceId: string | null): Answer {
    const q = this.current;
    if (!q) throw new Error("The round is over");
    const picked = choiceId ? choiceId.split(" ") : [];
    const correct = choiceId !== null && (q.accept ? q.accept.includes(choiceId) : choiceId === q.answer);
    const parts = q.accept
      ? [{ itemId: q.itemId, correct }]
      : partsOf(q).map((itemId, i) => ({ itemId, correct: picked[i] === itemId }));
    const a: Answer = { itemId: q.itemId, chosen: choiceId, correct, parts };
    this.answers.push(a);
    return a;
  }

  get score(): number {
    return this.answers.filter((a) => a.correct).length;
  }

  summary(): RoundSummary {
    const rules = modeRules(this.mode, this.level);
    const first = this.questions[0]!;
    const byId = new Map<string, ItemScore>();
    for (const a of this.answers) {
      for (const p of a.parts) {
        const choice = first.choices.find((c) => c.id === p.itemId);
        const s = byId.get(p.itemId) ?? { itemId: p.itemId, label: choice?.label ?? p.itemId, spoken: choice?.spoken ?? p.itemId, right: 0, total: 0 };
        s.total++;
        if (p.correct) s.right++;
        byId.set(p.itemId, s);
      }
    }
    const items = rules.items.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    const practice = items.filter((s) => s.right < s.total).sort((a, b) => a.right / a.total - b.right / b.total);
    return { mode: this.mode, level: this.level, score: this.score, total: this.answers.length, items, practice };
  }
}
