// Note names in text. The pixel font has capitals only, so "Bb" would show as
// "BB": on screen, accidentals become real flat and sharp signs; for screen
// readers and announcements they become words.

import { esc } from "./html";

const NOTE = /\b([A-G])(bb|##|b|#)(?![A-Za-z0-9])/g;
const SIGN: Record<string, string> = { b: "♭", "#": "♯", bb: "♭♭", "##": "♯♯" };
const WORD: Record<string, string> = { b: "flat", "#": "sharp", bb: "double flat", "##": "double sharp" };

/** HTML for text with note names: "Eb" shows as E with a flat sign and reads as "E flat". */
export function prettyNotes(text: string): string {
  return esc(text).replace(
    NOTE,
    (_, letter: string, acc: string) =>
      `${letter}<span class="acc" aria-hidden="true">${SIGN[acc]}</span><span class="sr-only"> ${WORD[acc]}</span>`,
  );
}

/** Plain text for announcements: "Eb up to G" becomes "E flat up to G". */
export function sayNotes(text: string): string {
  return text.replace(NOTE, (_, letter: string, acc: string) => `${letter} ${WORD[acc]}`);
}
