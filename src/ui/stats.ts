// The stats page and the progress panel: player level, XP, streak, and
// accuracy per mode and level over time. Every small chart has the same
// numbers as text, so nothing depends on seeing the bars.

import { levelStats, playerLevel, streakToday, weakestItems, type LevelStats } from "../progress/progress";
import type { Saved } from "../progress/storage";
import { MODES, makeQuestion } from "../quiz/modes";
import { Rng } from "../quiz/rng";
import { LEVEL_IDS, LEVEL_NAMES, type LevelId, type ModeId } from "../quiz/types";
import { esc, frac } from "./html";
import { prettyNotes } from "./notes";
import { sprite } from "./sprites";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** The level, XP bar and streak, for the home screen. */
export function progressPanel(saved: Saved, today: string): string {
  const lv = playerLevel(saved.xp);
  const st = streakToday(saved.streak, today);
  const width = Math.round((lv.into / lv.span) * 100);
  const streakLine =
    st.days > 0
      ? `${st.days} day streak${st.playToday ? ". Play today to keep it going" : ""}`
      : st.best > 0
        ? `Start a new streak today. Best: ${st.best} days`
        : "Play a round each day to build a streak";
  return `
    <section class="panel progress" aria-label="Your progress">
      <div class="progress-row">
        <span class="lv"><span aria-hidden="true">LV ${lv.level}</span><span class="sr-only">Level ${lv.level}</span></span>
        <div class="xpbar" role="progressbar" aria-label="XP toward level ${lv.level + 1}" aria-valuemin="0"
          aria-valuemax="${lv.span}" aria-valuenow="${lv.into}" aria-valuetext="${lv.into} of ${lv.span} XP toward level ${lv.level + 1}">
          <i style="width:${width}%"></i>
        </div>
        <span class="xp-text">${saved.xp} XP</span>
      </div>
      <p class="streak${st.days > 0 ? " is-on" : ""}">${sprite("flame", 2)}<span>${esc(streakLine)}</span></p>
    </section>`;
}

/** Spoken and short names of an item, for the weak-spots list. */
function itemNames(mode: ModeId, level: LevelId, itemId: string): { spoken: string; label: string } {
  try {
    const q = makeQuestion(mode, level, itemId, new Rng(1), { history: {} });
    const c = q.choices.find((x) => x.id === itemId);
    if (c) return { spoken: c.spoken, label: c.label };
  } catch {
    // An item from an older version: show its id.
  }
  return { spoken: itemId, label: itemId };
}

function trendText(t: number | null): string {
  if (t === null) return "";
  const pts = Math.round(t * 100);
  if (pts >= 5) return `Up ${pts} points lately`;
  if (pts <= -5) return `Down ${-pts} points lately`;
  return "Steady lately";
}

/** One level's row: numbers as text, then the last rounds as small bars. */
function levelRow(s: LevelStats): string {
  if (s.rounds === 0) {
    return `<li class="stat-row is-empty"><span class="stat-level">${LEVEL_NAMES[s.level]}</span><span class="stat-meta">Not played yet</span></li>`;
  }
  const scores = s.recent.map((r) => Math.round(r * 10));
  const bars = s.recent
    .map((r, i) => `<i style="height:${Math.max(6, Math.round(r * 100))}%" title="Round ${i + 1}: ${scores[i]}/10"></i>`)
    .join("");
  return `<li class="stat-row">
      <span class="stat-level">${LEVEL_NAMES[s.level]}</span>
      <span class="stat-acc">${pct(s.accuracy!)}</span>
      <span class="stat-meta">${s.rounds} round${s.rounds === 1 ? "" : "s"}. Best ${frac(Math.round(s.best! * 10), 10)}.${s.trend !== null ? ` ${trendText(s.trend)}.` : ""}</span>
      <span class="spark" aria-hidden="true">${bars}</span>
      <span class="sr-only">Last ${scores.length} rounds, out of 10: ${scores.join(", ")}.</span>
    </li>`;
}

export function statsPage(saved: Saved, today: string): string {
  const lv = playerLevel(saved.xp);
  const st = streakToday(saved.streak, today);
  const right = saved.rounds.reduce((n, r) => n + r.score, 0);
  const asked = saved.rounds.reduce((n, r) => n + r.total, 0);

  const modes = MODES.map((m) => {
    const rows = LEVEL_IDS.map((l) => levelRow(levelStats(saved.rounds, m.id, l))).join("");
    return `<section class="panel">
        <h2 class="section-title">${esc(m.name)}</h2>
        <ul class="stat-list">${rows}</ul>
      </section>`;
  }).join("");

  const weak = weakestItems(saved.history, 6);
  const weakList = weak.length
    ? `<ul class="item-list">${weak
        .map((w) => {
          const n = itemNames(w.mode, w.level, w.itemId);
          const mode = MODES.find((m) => m.id === w.mode)?.name ?? w.mode;
          return `<li class="item-row">
            <span class="item-name">${esc(n.spoken.charAt(0).toUpperCase() + n.spoken.slice(1))}${n.label !== n.spoken ? ` <span aria-hidden="true">(${prettyNotes(n.label)})</span>` : ""}<br><span class="stat-meta">${esc(mode)}, ${LEVEL_NAMES[w.level]}</span></span>
            <span class="item-score">${w.right} of ${w.total}</span>
          </li>`;
        })
        .join("")}</ul><p class="menu-note">From your recent answers. These come up more often in rounds.</p>`
    : `<p class="practice">Nothing yet. Play a few rounds and your weak spots show up here.</p>`;

  return `
    <header class="topbar">
      <button class="icon-btn" type="button" data-act="home" aria-label="Back to modes">${sprite("back", 3)}</button>
      <h1 class="title" tabindex="-1">Stats</h1>
    </header>
    <section class="panel">
      <h2 class="section-title">Overall</h2>
      <dl class="stats">
        <dt>Player level</dt><dd>${lv.level}</dd>
        <dt>Total XP</dt><dd>${saved.xp}</dd>
        <dt>Streak</dt><dd>${st.days} day${st.days === 1 ? "" : "s"}</dd>
        <dt>Best streak</dt><dd>${st.best} day${st.best === 1 ? "" : "s"}</dd>
        <dt>Rounds played</dt><dd>${saved.rounds.length}</dd>
        <dt>Accuracy</dt><dd>${asked ? pct(right / asked) : "None yet"}</dd>
      </dl>
      <p class="menu-note">Each mode below shows accuracy per level, with your last 10 rounds as bars (oldest on the left).</p>
    </section>
    ${modes}
    <section class="panel">
      <h2 class="section-title">Weak spots</h2>
      ${weakList}
    </section>
    <section class="panel">
      <h2 class="section-title">Start over</h2>
      <p class="menu-note">Erases XP, streaks, rounds and weak spots on this device. Settings stay.</p>
      <button class="btn btn--small btn--danger" type="button" data-act="reset" aria-describedby="reset-note">Reset progress</button>
      <p class="menu-note" id="reset-note" aria-live="polite"></p>
    </section>`;
}
