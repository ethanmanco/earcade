// A tappable guitar neck for Fretboard questions. Adapted from Sixline's
// Fretboard (src/fretboard/fretboard.ts): an ARIA grid of focusable cells
// with arrow-key moves, drawn vertically for phones (frets run down the
// screen, low E on the left).
//
// Cells never say which note they are until the answer is shown, so a
// screen reader does not give the answer away.

import { STRING_NAMES } from "../theory/guitar";
import type { FretPos, StringIndex } from "../theory/types";
import { prettyNotes } from "./notes";
import { sprite } from "./sprites";

const INLAYS = new Set([3, 5, 7, 9, 15]);
const COLUMN_LETTERS = ["E", "A", "D", "G", "B", "E"];
const key = (s: number, f: number) => `${s}:${f}`;

export interface BoardOptions {
  /** Strings that can be tapped (others are shown but disabled). */
  strings: readonly number[];
  frets: readonly [number, number];
  onPick(pos: FretPos): void;
}

export class QuizBoard {
  readonly el: HTMLElement;
  private cells = new Map<string, HTMLElement>();
  private focusPos: FretPos;
  private locked = false;

  constructor(private opts: BoardOptions) {
    const [lo, hi] = opts.frets;
    const rows = hi - lo + 1;
    this.el = document.createElement("div");
    this.el.className = "board";
    this.el.setAttribute("role", "grid");
    this.el.setAttribute(
      "aria-label",
      `Guitar neck, frets ${lo} to ${hi}. Rows are frets, columns are strings, low E on the left.`,
    );
    this.el.setAttribute("aria-rowcount", String(rows + 1));
    this.el.setAttribute("aria-colcount", "7");
    this.el.style.setProperty("--rows", String(rows));
    this.focusPos = { string: opts.strings[0] as StringIndex, fret: lo };

    const head = document.createElement("div");
    head.className = "board-row board-head";
    head.setAttribute("role", "row");
    head.innerHTML =
      `<span class="board-num" role="columnheader" aria-label="Fret"></span>` +
      COLUMN_LETTERS.map(
        (l, s) =>
          `<span class="board-letter${opts.strings.includes(s) ? "" : " is-off"}" role="columnheader" aria-label="${STRING_NAMES[s]} string">${l}</span>`,
      ).join("");
    this.el.append(head);

    for (let f = lo; f <= hi; f++) {
      const row = document.createElement("div");
      row.className = `board-row${f === 0 ? " is-open" : ""}`;
      row.setAttribute("role", "row");
      row.dataset.f = String(f);
      const inlay = f === 12 ? `<i class="board-inlay is-double" aria-hidden="true"></i>` : INLAYS.has(f) ? `<i class="board-inlay" aria-hidden="true"></i>` : "";
      row.innerHTML = `<span class="board-num${INLAYS.has(f) || f === 12 ? " is-marked" : ""}" role="rowheader" aria-label="${f === 0 ? "Open strings" : `Fret ${f}`}">${f}</span>${inlay}`;
      for (let s = 0; s < 6; s++) {
        const cell = document.createElement("div");
        const on = opts.strings.includes(s);
        cell.className = `board-cell${on ? "" : " is-off"}`;
        cell.setAttribute("role", "gridcell");
        cell.tabIndex = -1;
        cell.dataset.s = String(s);
        cell.dataset.f = String(f);
        cell.setAttribute("aria-label", `${STRING_NAMES[s]} string, ${f === 0 ? "open" : `fret ${f}`}${on ? "" : ", not used at this level"}`);
        if (!on) cell.setAttribute("aria-disabled", "true");
        cell.innerHTML = `<span class="board-dot" aria-hidden="true"></span>`;
        this.cells.set(key(s, f), cell);
        row.append(cell);
      }
      this.el.append(row);
    }
    this.setFocus(this.focusPos, false);

    this.el.addEventListener("click", (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>(".board-cell");
      if (cell) this.activate(cell);
    });
    this.el.addEventListener("keydown", (e) => this.onKey(e));
    this.el.addEventListener("focusin", (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>(".board-cell");
      if (cell) this.setFocus(this.posOf(cell), false);
    });
  }

  /** Moves keyboard focus into the neck. */
  focus(): void {
    this.cells.get(key(this.focusPos.string, this.focusPos.fret))?.focus();
  }

  /**
   * Shows the answer: every right spot gets a check and its note name; a
   * wrong tap gets a cross and the note it really is.
   */
  reveal(right: readonly FretPos[], tapped: FretPos | null, tappedName: string, note: string): void {
    this.locked = true;
    for (const p of right) {
      const cell = this.cells.get(key(p.string, p.fret));
      if (!cell) continue;
      cell.classList.add("is-right");
      const isTap = tapped && tapped.string === p.string && tapped.fret === p.fret;
      cell.querySelector(".board-dot")!.innerHTML = `${prettyNotes(note)}${isTap ? `<span class="board-mark">${sprite("check", 1)}</span>` : ""}`;
      cell.setAttribute("aria-label", `${cell.getAttribute("aria-label")}, ${note}, right answer${isTap ? ", your tap" : ""}`);
    }
    if (tapped && !right.some((p) => p.string === tapped.string && p.fret === tapped.fret)) {
      const cell = this.cells.get(key(tapped.string, tapped.fret));
      if (cell) {
        cell.classList.add("is-wrong");
        cell.querySelector(".board-dot")!.innerHTML = `${prettyNotes(tappedName)}<span class="board-mark">${sprite("cross", 1)}</span>`;
        cell.setAttribute("aria-label", `${cell.getAttribute("aria-label")}, ${tappedName}, your tap, wrong`);
      }
    }
    for (const cell of this.cells.values()) cell.setAttribute("aria-disabled", "true");
    this.el.classList.add("is-done");
  }

  private posOf(cell: HTMLElement): FretPos {
    return { string: Number(cell.dataset.s) as StringIndex, fret: Number(cell.dataset.f) };
  }

  private activate(cell: HTMLElement): void {
    if (this.locked || cell.classList.contains("is-off")) return;
    this.opts.onPick(this.posOf(cell));
  }

  private setFocus(pos: FretPos, move: boolean): void {
    this.cells.get(key(this.focusPos.string, this.focusPos.fret))?.setAttribute("tabindex", "-1");
    this.focusPos = pos;
    const cell = this.cells.get(key(pos.string, pos.fret));
    if (!cell) return;
    cell.setAttribute("tabindex", "0");
    if (move) cell.focus();
  }

  private onKey(e: KeyboardEvent): void {
    const cell = (e.target as HTMLElement).closest<HTMLElement>(".board-cell");
    if (!cell) return;
    const { string: s, fret: f } = this.posOf(cell);
    const [lo, hi] = this.opts.frets;
    let next: FretPos | null = null;
    switch (e.key) {
      case "Enter":
      case " ":
        // After answering, Enter belongs to the round screen (next question).
        if (this.locked) return;
        e.preventDefault();
        e.stopPropagation();
        this.activate(cell);
        return;
      case "ArrowUp":
        next = { string: s as StringIndex, fret: Math.max(lo, f - 1) };
        break;
      case "ArrowDown":
        next = { string: s as StringIndex, fret: Math.min(hi, f + 1) };
        break;
      case "ArrowLeft":
        next = { string: Math.max(0, s - 1) as StringIndex, fret: f };
        break;
      case "ArrowRight":
        next = { string: Math.min(5, s + 1) as StringIndex, fret: f };
        break;
      case "Home":
        next = { string: s as StringIndex, fret: lo };
        break;
      case "End":
        next = { string: s as StringIndex, fret: hi };
        break;
      default:
        return;
    }
    e.preventDefault();
    this.setFocus(next, true);
  }
}
