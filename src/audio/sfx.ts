// Chiptune game sounds, synthesized with Web Audio: square and triangle waves.
// Adapted from Pocket Pixels (src/ui/sfx.ts). Kept short and quiet so they
// never get in the way of the notes being trained.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let volume = 0.8;

function level(): number {
  return enabled ? 0.35 * volume : 0;
}

export function setGameSounds(on: boolean, vol: number): void {
  enabled = on;
  volume = vol;
  if (master) master.gain.value = level();
}

/** Browsers only allow audio after a tap; call this from the first one. */
export function unlockSfx(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = level();
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, at: number, dur: number, opts: { type?: OscillatorType; vol?: number; to?: number } = {}): void {
  if (!enabled || !ctx || !master || ctx.state !== "running") return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? "square";
  osc.frequency.setValueAtTime(freq, t);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  gain.gain.setValueAtTime(opts.vol ?? 0.1, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  /** Two quick rising blips. */
  correct(): void {
    tone(1319, 0, 0.06, { vol: 0.07 });
    tone(1760, 0.07, 0.09, { vol: 0.07 });
  },
  /** A short low buzz that falls. */
  wrong(): void {
    tone(220, 0, 0.16, { type: "triangle", vol: 0.16, to: 140 });
  },
  /** End of a round. */
  fanfare(): void {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, i === 3 ? 0.25 : 0.08, { vol: 0.07 }));
  },
  /** A tick for the last seconds of a timer. */
  tick(): void {
    tone(2000, 0, 0.02, { vol: 0.03 });
  },
};
