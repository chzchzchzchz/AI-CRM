import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  // tRPC's default shape includes the server-side stack trace in `error.data` for
  // every error, in every environment — confirmed live: a plain validation failure
  // ("Password must contain at least one uppercase letter") came back with a full
  // stack including this server's absolute filesystem path
  // (/Users/.../server/routers.ts:250:17). The message a caller needs is `.message`;
  // the stack is for this process's own logs, not the network.
  errorFormatter({ shape, error }) {
    const { stack: _stack, ...dataWithoutStack } = shape.data as Record<string, unknown>;
    void error;
    return { ...shape, data: dataWithoutStack };
  },
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
