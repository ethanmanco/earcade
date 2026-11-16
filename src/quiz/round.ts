// A round: 10 questions, the answers given, and the summary at the end.
// No screen and no sound here, so it can be tested directly.

import { pickItems } from "./adaptive";
import { modeRules, makeQuestion } from "./modes";
import type { Rng } from "./rng";
import type { ItemHistory, LevelId, ModeId, Question } from "./types";

export const ROUND_LENGTH = 10;

export interface Answer {
  itemId: string;
  /** Choice id picked, or null when time ran out. */
  chosen: string | null;
  correct: boolean;
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
    this.questions = pickItems(rules.items, history, rng, ROUND_LENGTH).map((id) => makeQuestion(mode, level, id, rng));
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
    const a: Answer = { itemId: q.itemId, chosen: choiceId, correct: choiceId === q.answer };
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
      const choice = first.choices.find((c) => c.id === a.itemId);
      const s = byId.get(a.itemId) ?? { itemId: a.itemId, label: choice?.label ?? a.itemId, spoken: choice?.spoken ?? a.itemId, right: 0, total: 0 };
      s.total++;
      if (a.correct) s.right++;
      byId.set(a.itemId, s);
    }
    const items = rules.items.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    const practice = items.filter((s) => s.right < s.total).sort((a, b) => a.right / a.total - b.right / b.total);
    return { mode: this.mode, level: this.level, score: this.score, total: this.answers.length, items, practice };
  }
}
