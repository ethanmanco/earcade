// Copied from Sixline (src/core/types.ts): only the guitar positions Earcade needs.

/** 0 = low E (6th string), 5 = high E (1st string). */
export type StringIndex = 0 | 1 | 2 | 3 | 4 | 5;

export interface FretPos {
  string: StringIndex;
  /** 0 (open) to 15. Always absolute, counted from the nut. */
  fret: number;
}
