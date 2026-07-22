/**
 * Shared Signal Room helpers.
 *
 * heatMeta maps an intent score to a heat read that pairs a tinted color with a glyph AND a
 * word, so it never relies on color alone (DESIGN.md). This is the analytics-context scale
 * (3-tier, emerald "hot") used by the Dashboard and Top Accounts views. The account/contact
 * detail views intentionally use a different 4-tier temperature scale, so they keep their own
 * local helper — do not force those onto this one without a design decision.
 */
export type Heat = { label: string; glyph: string; text: string };

export function heatMeta(score: number): Heat {
  if (score >= 70) return { label: "Hot", glyph: "▲", text: "text-emerald-400" };
  if (score >= 40) return { label: "Warm", glyph: "●", text: "text-amber-400" };
  return { label: "Cold", glyph: "○", text: "text-slate-400" };
}
