import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import { formatTrpcError } from "./trpc";

/**
 * Two independent leaks in every error response, both confirmed live:
 *  1. The server's own stack trace — absolute filesystem paths included — rode
 *     along in `error.data.stack` regardless of environment.
 *  2. A zod .input() validation failure reported `message` as the entire issues
 *     array JSON.stringify'd, burying the schema's own human-readable text
 *     ("Transcript must be at least 100 characters") inside a blob instead of
 *     surfacing it directly.
 */
describe("formatTrpcError", () => {
  it("strips the stack trace from the response data", () => {
    const shape = {
      message: "Something broke",
      code: -32600,
      data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500, stack: "Error: x\n    at /Users/me/app/server/routers.ts:1:1" },
    };
    const result = formatTrpcError({ shape, error: { cause: new Error("Something broke") } });
    expect(result.data).not.toHaveProperty("stack");
    expect(result.message).toBe("Something broke");
  });

  it("replaces a zod issues dump with the schema's own message", () => {
    const zodError = new ZodError([
      { code: "too_small", minimum: 100, type: "string", inclusive: true, path: ["transcript"], message: "Transcript must be at least 100 characters" } as any,
    ]);
    const shape = {
      message: JSON.stringify(zodError.issues, null, 2),
      code: -32600,
      data: { code: "BAD_REQUEST", httpStatus: 400 },
    };
    const result = formatTrpcError({ shape, error: { cause: zodError } });
    expect(result.message).toBe("Transcript must be at least 100 characters");
  });

  it("leaves a non-zod error's message untouched", () => {
    const shape = { message: "Admin access required", code: -32603, data: { code: "FORBIDDEN", httpStatus: 403 } };
    const result = formatTrpcError({ shape, error: { cause: new Error("Admin access required") } });
    expect(result.message).toBe("Admin access required");
  });
});
