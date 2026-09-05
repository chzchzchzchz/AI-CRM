import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { assertDeploymentConnectorAllowed, assertOrgAllowed, orgIdFor } from "./tenancy";

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

  // Narrowed to a number here, not left `number | null`, so a resolver cannot
  // accidentally build a query with a nullish org and have it read as "no filter".
  // Every signed-in user has an org: the column defaults to 1 and is not nullable.
  const orgId = orgIdFor(ctx.user);

  // The load-bearing guard. There is no UI for creating a second organization, so the
  // only way a user row carries one today is an operator putting it there by hand —
  // exactly the person about to onboard a second customer onto one deployment. While
  // any query still runs unscoped, that user's requests would read the first customer's
  // accounts. Refuse the request and say why, rather than serving the wrong tenant's
  // data and being right about the login.
  assertOrgAllowed(orgId);

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      orgId,
    },
  });
});

/**
 * A signed-in user, with `ctx.orgId` narrowed to a number.
 *
 * The name is the point: `protectedProcedure` reads as "this is protected", and what it
 * actually guaranteed was only "somebody is signed in" — it said nothing about whose data
 * the resolver then went and read. Both names now resolve the tenant; the query still has
 * to use it, which is what `pnpm tenancy` counts and `pnpm check:claims` pins.
 */
export const protectedProcedure = t.procedure.use(requireUser);
export const orgProcedure = protectedProcedure;

/**
 * A signed-in user of the organization that owns this deployment's connector credentials.
 *
 * Every connector in this app is configured from the deployment's environment — one
 * SALESFORCE_*, one GONG_*, one TWILIO_*, shared by every tenant on the instance. The org
 * work made every WRITE land in the caller's own tenant and stopped there; it never asked
 * whether the vendor account being spent or read was the caller's. So on a self-serve
 * deployment a customer who signed up two minutes ago could pull the operator's entire
 * Salesforce org into their workspace, read their Gong call transcripts verbatim, or send
 * SMS on their Twilio account — with every resulting row correctly scoped to themselves,
 * which is exactly what made it invisible.
 *
 * Per-organization credentials are the real answer and are a feature, not a guard. Until
 * they exist this refuses, which is the honest half.
 *
 * A no-op on every single-tenant install: everyone is in the default org.
 */
export const deploymentConnectorProcedure = protectedProcedure.use(
  t.middleware(async ({ ctx, next }) => {
    // requireUser has already run and narrowed this to a number; the type here is the
    // base context's. A null org means no session at all, which is not the deployment's
    // organization either — refusing is the same answer.
    // No vendor name: a procedure name like `salesloftCreatePerson` reads as jargon in a
    // sentence aimed at whoever pressed the button. Call sites that know the vendor —
    // Salesforce, Gong — call the guard directly and name it.
    assertDeploymentConnectorAllowed(ctx.orgId ?? -1, "This connector");
    return next({ ctx });
  })
);

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
