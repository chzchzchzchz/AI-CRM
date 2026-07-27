import { describe, it, expect } from "vitest";
import { orderSteps, summarise, type SequenceStep } from "./sequences";

const step = (over: Partial<SequenceStep>): SequenceStep => ({
  id: "s",
  type: "email",
  day: 0,
  ...over,
});

/**
 * A sequence's shape is what the rep is judging: does this rhythm make sense end to
 * end. Both of these are derived rather than stored, so they cannot drift from the
 * steps they describe — but they have to be right about them.
 */
describe("orderSteps", () => {
  it("puts steps in day order regardless of how they were added", () => {
    const out = orderSteps([
      step({ id: "c", day: 14 }),
      step({ id: "a", day: 0 }),
      step({ id: "b", day: 3 }),
    ]);
    expect(out.map(s => s.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps same-day steps together without dropping either", () => {
    // A call and a LinkedIn touch on the same day is a normal cadence, not a conflict.
    const out = orderSteps([
      step({ id: "call", type: "call", day: 3 }),
      step({ id: "li", type: "linkedin", day: 3 }),
      step({ id: "first", day: 0 }),
    ]);
    expect(out).toHaveLength(3);
    expect(out[0].id).toBe("first");
    expect(out.slice(1).map(s => s.id).sort()).toEqual(["call", "li"]);
  });

  it("does not mutate the input array", () => {
    const input = [step({ id: "b", day: 5 }), step({ id: "a", day: 1 })];
    orderSteps(input);
    expect(input.map(s => s.id)).toEqual(["b", "a"]);
  });

  it("handles an empty sequence", () => {
    expect(orderSteps([])).toEqual([]);
  });
});

describe("summarise", () => {
  it("reports duration as the last day, not the number of steps", () => {
    const s = summarise([step({ day: 0 }), step({ day: 3 }), step({ day: 21 })]);
    expect(s.stepCount).toBe(3);
    expect(s.durationDays).toBe(21);
  });

  it("counts each channel", () => {
    const s = summarise([
      step({ type: "email", day: 0 }),
      step({ type: "email", day: 3 }),
      step({ type: "call", day: 5 }),
      step({ type: "wait", day: 6 }),
    ]);
    expect(s.byType).toEqual({ email: 2, call: 1, wait: 1 });
  });

  it("flags steps with no copy — deferred work, not finished work", () => {
    const s = summarise([
      step({ type: "email", day: 0, content: "Hello" }),
      step({ type: "email", day: 3 }),
      step({ type: "call", day: 5, content: "   " }),
    ]);
    expect(s.incomplete).toBe(2);
  });

  it("never counts a wait step as missing copy", () => {
    // A wait has nothing to write; counting it would make every sequence look unfinished.
    const s = summarise([step({ type: "wait", day: 2 }), step({ type: "wait", day: 9 })]);
    expect(s.incomplete).toBe(0);
  });

  it("returns zero duration for an empty sequence rather than -Infinity", () => {
    // Math.max() with no arguments is -Infinity, which would render as "-Infinity days".
    const s = summarise([]);
    expect(s.durationDays).toBe(0);
    expect(s.stepCount).toBe(0);
  });
});
