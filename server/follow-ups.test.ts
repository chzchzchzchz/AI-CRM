import { describe, it, expect } from "vitest";
import { daysUntil, snoozeTarget, startOfToday } from "./follow-ups";

/**
 * Follow-ups are the one feature where being off by a day is the whole bug: an item
 * that shows as overdue the evening it was created, or a snooze that lands in the past,
 * makes the daily list untrustworthy — and a list a rep doesn't trust is one they stop
 * opening.
 */

const at = (iso: string) => new Date(iso);

describe("daysUntil", () => {
  it("counts a follow-up due today as 0 whatever the hour", () => {
    // Created at 23:00, read at 23:30 — must not already be a day overdue.
    const now = at("2026-07-26T23:30:00");
    expect(daysUntil(at("2026-07-26T09:00:00"), now)).toBe(0);
    expect(daysUntil(at("2026-07-26T23:59:00"), now)).toBe(0);
  });

  it("counts tomorrow as 1 even from late tonight", () => {
    const now = at("2026-07-26T23:30:00");
    expect(daysUntil(at("2026-07-27T00:30:00"), now)).toBe(1);
  });

  it("returns negatives for overdue items", () => {
    const now = at("2026-07-26T09:00:00");
    expect(daysUntil(at("2026-07-25T09:00:00"), now)).toBe(-1);
    expect(daysUntil(at("2026-07-05T09:00:00"), now)).toBe(-21);
  });

  it("counts a six-month horizon as roughly half a year, not a rounding artefact", () => {
    const now = at("2026-07-26T12:00:00");
    expect(daysUntil(at("2027-01-26T12:00:00"), now)).toBe(184);
  });

  it("survives a daylight-saving boundary without losing a day", () => {
    // A 23- or 25-hour day would give 0.96 or 1.04 under a floor; rounding keeps it 1.
    const now = at("2026-03-07T12:00:00");
    expect(daysUntil(at("2026-03-08T12:00:00"), now)).toBe(1);
    const back = at("2026-10-31T12:00:00");
    expect(daysUntil(at("2026-11-01T12:00:00"), back)).toBe(1);
  });
});

describe("snoozeTarget", () => {
  it("lands the requested number of days from today", () => {
    const now = at("2026-07-26T15:00:00");
    expect(daysUntil(snoozeTarget(7, now), now)).toBe(7);
    expect(daysUntil(snoozeTarget(90, now), now)).toBe(90);
  });

  it("rescues an overdue item instead of leaving it in the past", () => {
    // The bug this guards: snoozing "+7 days" from the ORIGINAL due date of something
    // three weeks overdue produces a date still two weeks behind, so the item stays
    // stuck at the top of the list and the button appears broken.
    const now = at("2026-07-26T09:00:00");
    const target = snoozeTarget(7, now);
    expect(target.getTime()).toBeGreaterThan(now.getTime());
    expect(daysUntil(target, now)).toBe(7);
  });

  it("normalises to local midnight, so the due date has no time-of-day drift", () => {
    const now = at("2026-07-26T15:47:33");
    const target = snoozeTarget(1, now);
    expect(target.getHours()).toBe(0);
    expect(target.getMinutes()).toBe(0);
    expect(target.getSeconds()).toBe(0);
  });

  it("crosses a month boundary by calendar date, not by adding milliseconds", () => {
    const now = at("2026-01-31T12:00:00");
    expect(daysUntil(snoozeTarget(1, now), now)).toBe(1);
    expect(snoozeTarget(1, now).getMonth()).toBe(1); // February
  });
});

describe("startOfToday", () => {
  it("floors to local midnight", () => {
    const d = startOfToday(at("2026-07-26T18:22:09"));
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(26);
  });
});
