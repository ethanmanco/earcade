import { describe, expect, it } from "vitest";
import { prettyNotes, sayNotes } from "../src/ui/notes";

describe("note names in text", () => {
  it("speaks accidentals as words", () => {
    expect(sayNotes("Eb up to Bb")).toBe("E flat up to B flat");
    expect(sayNotes("F# and C together")).toBe("F sharp and C together");
    expect(sayNotes("Db minor 7 flat 5, 1st inversion (Fb in the bass): Db Fb Abb Cb")).toBe(
      "D flat minor 7 flat 5, 1st inversion (F flat in the bass): D flat F flat A double flat C flat",
    );
  });

  it("leaves ordinary words alone", () => {
    expect(sayNotes("A minor, root position: A C E")).toBe("A minor, root position: A C E");
    expect(sayNotes("Bass and Ebony")).toBe("Bass and Ebony");
  });

  it("draws signs on screen with words for screen readers", () => {
    const html = prettyNotes("Bb major");
    expect(html).toContain("B<span class=\"acc\" aria-hidden=\"true\">♭</span>");
    expect(html).toContain("<span class=\"sr-only\"> flat</span>");
  });
});
