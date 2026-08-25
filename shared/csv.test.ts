import { describe, it, expect } from "vitest";
import { csvCell, csvRow } from "./csv";

describe("csvCell", () => {
  it("neutralizes the four formula-trigger characters with a leading quote", () => {
    // Every affected spreadsheet application reads a leading ' as "this cell is
    // text" and hides the quote in the cell's own display.
    expect(csvCell('=HYPERLINK("https://evil/x")')).toBe('"\'=HYPERLINK(""https://evil/x"")"');
    expect(csvCell("=cmd|' /c calc'!A1")).toContain("'=cmd|");
    expect(csvCell("+1+1")).toBe("'+1+1");
    expect(csvCell("-1+1")).toBe("'-1+1");
    expect(csvCell("@SUM(1)")).toBe("'@SUM(1)");
  });

  it("leaves an ordinary value starting with those characters' non-trigger neighbors alone", () => {
    // Nothing here starts with =, +, -, or @, so nothing gets the defensive prefix.
    expect(csvCell("John Smith")).toBe("John Smith");
    expect(csvCell("2024-01-15")).toBe("2024-01-15"); // a date, not a leading '-'
    expect(csvCell("50%")).toBe("50%");
  });

  it("still escapes structural characters after neutralizing a formula trigger", () => {
    // The quote and the comma both need to survive round-tripping through a real
    // CSV parser, not just look right when eyeballed.
    const out = csvCell('=A1,"gotcha"');
    expect(out.startsWith('"')).toBe(true);
    expect(out.endsWith('"')).toBe(true);
    expect(out).toContain("'=A1");
    expect(out).toContain('""gotcha""');
  });

  it("wraps in quotes only when the value actually needs it", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("has,comma")).toBe('"has,comma"');
    expect(csvCell('has"quote')).toBe('"has""quote"');
    expect(csvCell("has\nnewline")).toBe('"has\nnewline"');
  });

  it("treats null, undefined and empty as an empty cell, not the literal string", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell("")).toBe("");
  });
});

describe("csvRow", () => {
  it("joins cells with commas, each independently escaped", () => {
    expect(csvRow(["a", "b,c", "=1+1"])).toBe('a,"b,c",\'=1+1');
  });

  it("round-trips through a naive split for a formula-injection payload actually landing in a real record", () => {
    // The realistic path this defends: an uploaded lead list with a poisoned company
    // name, processed and re-exported for someone to open in Excel.
    const row = csvRow(["Acme Corp", "=cmd|' /c calc'!A1", "jane@acme.com"]);
    const cells = row.split(",");
    // The payload cell must not begin with the formula trigger anymore.
    expect(cells.some((c) => c.startsWith("="))).toBe(false);
  });
});
