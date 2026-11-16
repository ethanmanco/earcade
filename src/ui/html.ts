// Small helpers for building markup safely.

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** "9/10" on screen, "9 of 10" for screen readers. */
export function frac(a: number, b: number): string {
  return `<span aria-hidden="true">${a}/${b}</span><span class="sr-only">${a} of ${b}</span>`;
}
