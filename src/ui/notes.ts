// Note names in text. The pixel font has capitals only, so "Bb" would show as
// "BB": on screen, accidentals become real flat and sharp signs; for screen
// readers and announcements they become words.

import { esc } from "./html";

const NOTE = /\b([A-G])(bb|##|b|#)(?![A-Za-z0-9])/g;
const SIGN: Record<string, string> = { b: "♭", "#": "♯", bb: "♭♭", "##": "♯♯" };
const WORD: Record<string, string> = { b: "flat", "#": "sharp", bb: "double flat", "##": "double sharp" };

// Degree labels such as "b3" or "#4" (not after a letter, so "Bb3" stays a note).
const DEGREE = /(^|[^A-Za-z0-9#&;])(b|#)(\d{1,2})(?!\d)/g;

/** HTML for text with note names: "Eb" shows as E with a flat sign and reads as "E flat". */
export function prettyNotes(text: string): string {
  return esc(text)
    .replace(
      DEGREE,
      (_, pre: string, acc: string, num: string) =>
        `${pre}<span class="acc" aria-hidden="true">${SIGN[acc]}</span><span class="sr-only">${WORD[acc]} </span>${num}`,
    )
    .replace(
    NOTE,
    (_, letter: string, acc: string) =>
      `${letter}<span class="acc" aria-hidden="true">${SIGN[acc]}</span><span class="sr-only"> ${WORD[acc]}</span>`,
  );
}

/** Plain text for announcements: "Eb up to G" becomes "E flat up to G". */
export function sayNotes(text: string): string {
  return text
    .replace(DEGREE, (_, pre: string, acc: string, num: string) => `${pre}${WORD[acc]} ${num}`)
    .replace(NOTE, (_, letter: string, acc: string) => `${letter} ${WORD[acc]}`);
}
