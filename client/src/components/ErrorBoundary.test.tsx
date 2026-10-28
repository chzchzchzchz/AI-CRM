// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

/**
 * The one component standing between a bug in any page and a blank white screen.
 *
 * This repo has no other client-side tests — everything else here is server
 * contract tests or a real browser walking the built app. This one component
 * earns jsdom and @testing-library/react on its own: it is pure, has no network
 * or router dependency, and is the last line of defense for every defect this
 * session did not find. A broken boundary is worse than no boundary, because it
 * is the one thing a rep has no way to notice is missing until the day they need it.
 */

function Bomb(): never {
  throw new Error("kaboom");
}

afterEach(() => cleanup());

describe("ErrorBoundary", () => {
  it("renders children normally when nothing throws", () => {
    render(
      <ErrorBoundary>
        <div>hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("hello")).toBeTruthy();
  });

  it("catches a render error instead of leaving a blank page", () => {
    // React logs the error to console.error on its own during the throw; that is
    // expected noise from React itself, not a failure of this test.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    // The fallback, not a blank tree and not the thrown component.
    expect(screen.getByText(/unexpected error occurred/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /reload page/i })).toBeTruthy();

    err.mockRestore();
  });

  it("logs the crash instead of letting it vanish once the fallback is shown", () => {
    // The defect this test exists for: componentDidCatch did not exist. The
    // fallback covered the crash on screen and nothing recorded that it happened
    // — no console entry, no server log, nothing to find later.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    const loggedByBoundary = err.mock.calls.some(
      (call) => typeof call[0] === "string" && call[0].includes("[ErrorBoundary]")
    );
    expect(loggedByBoundary).toBe(true);

    err.mockRestore();
  });

  it("does not catch an error thrown by a sibling outside it", () => {
    // A boundary that swallows unrelated failures is as wrong as one that catches
    // nothing — it would hide errors it was never meant to be responsible for.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      render(
        <div>
          <ErrorBoundary>
            <div>protected</div>
          </ErrorBoundary>
          <Bomb />
        </div>
      )
    ).toThrow("kaboom");

    err.mockRestore();
  });
});
