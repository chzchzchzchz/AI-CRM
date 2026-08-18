import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import superjson from "superjson";
import type { TrpcContext } from "./context";

/**
 * Extracted as a standalone function (rather than inlined in `.create()`) so it can
 * be unit-tested directly against a `{shape, error}` pair without booting a server.
 */
export function formatTrpcError({ shape, error }: { shape: any; error: any }) {
  // tRPC's default shape includes the server-side stack trace in `error.data` for
  // every error, in every environment — confirmed live: a plain validation failure
  // ("Password must contain at least one uppercase letter") came back with a full
  // stack including this server's absolute filesystem path
  // (/Users/.../server/routers.ts:250:17). The message a caller needs is `.message`;
  // the stack is for this process's own logs, not the network.
  const { stack: _stack, ...dataWithoutStack } = shape.data as Record<string, unknown>;

  // When a zod .input() schema rejects a request, tRPC's default `message` is the
  // whole issues array JSON-stringified — confirmed live:
  // analyzeTranscript with a 1-character transcript returned
  // `message: "[\n  {\n    \"code\": \"too_small\", ... }\n]"` instead of the
  // schema's own friendly text ("Transcript must be at least 100 characters"),
  // which is buried inside that blob. Every zod schema in this codebase already
  // writes a human message per field (`.min(100, '...')`); surface that instead of
  // the raw parse-error dump.
  const zodMessage =
    error.cause instanceof ZodError ? error.cause.issues[0]?.message : undefined;

  return { ...shape, message: zodMessage ?? shape.message, data: dataWithoutStack };
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter: formatTrpcError,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
