import { AsyncLocalStorage } from "node:async_hooks";
import { eq } from "drizzle-orm";
import { organizations } from "../../drizzle/schema";
import { DEFAULT_ORG_ID } from "./tenancy";

/**
 * Whose company the AI writes as.
 *
 * `COMPANY_NAME`, the description, the differentiators, the target customers and the
 * competitor list are read by `getCompanyConfig()` from the deployment's environment, and
 * they ground every generated email, every account brief, every call analysis. One set of
 * values for the whole instance.
 *
 * So on a self-serve deployment, a second customer's outreach went out written as the
 * OPERATOR's company — pitching the operator's product, against the operator's named
 * competitors, to the customer's own prospects. Their accounts and contacts were perfectly
 * isolated; the sentence wrapped around them was somebody else's.
 *
 * ── Why a scope rather than an argument ──────────────────────────────────────────────
 *
 * `getCompanyConfig()` is synchronous, module-cached, and called from 43 places — prompt
 * builders several frames deep inside AI paths that have no idea an organization exists.
 * Threading an orgId through all of them would be a large, mechanical, error-prone change
 * whose failure mode is silent: miss one call site and that one prompt keeps the old
 * identity, which is precisely the bug.
 *
 * The scope is set once, in the tRPC middleware that already resolves ctx.orgId, so every
 * call site inside a request is covered by construction and none of them change.
 *
 * Outside a scope — CLI tooling, the connector smoke test, the demo — it reads the
 * deployment's config exactly as before.
 */

export type CompanyProfile = {
  companyName?: string;
  companyDescription?: string;
  industry?: string;
  productName?: string;
  productDescription?: string;
  keyDifferentiators?: string[];
  targetCustomers?: string;
  competitors?: string;
};

/** The fields a customer can set, and what each one does to the writing. */
export const PROFILE_FIELDS: {
  key: keyof CompanyProfile;
  label: string;
  hint: string;
  list?: boolean;
  long?: boolean;
}[] = [
  { key: "companyName", label: "Company name", hint: "Who the AI says it is writing on behalf of." },
  { key: "productName", label: "Product name", hint: "Named in emails and in 2FA enrolment." },
  { key: "companyDescription", label: "What you do", hint: "One line. Sets the tone of every draft.", long: true },
  { key: "industry", label: "Industry", hint: "e.g. B2B SaaS." },
  { key: "productDescription", label: "What you sell", hint: "The thing being pitched.", long: true },
  { key: "keyDifferentiators", label: "Differentiators", hint: "Comma-separated. The AI leans on these.", list: true },
  { key: "targetCustomers", label: "Who you sell to", hint: "Used to judge fit.", long: true },
  { key: "competitors", label: "Competitors", hint: "Comma-separated. Named in positioning." },
];

/**
 * A profile, plus what a blank field in it MEANS.
 *
 * Two different things are both "empty", and conflating them reintroduced the defect once
 * already:
 *
 *   inherit: true   an overlay. A blank field falls through to the deployment's value.
 *                   Right for the workspace that OWNS the deployment and has renamed
 *                   itself but not restated its competitors.
 *
 *   inherit: false  the whole identity. A blank field is blank. Right for every other
 *                   workspace, because falling through would put the operator's
 *                   differentiators in their outreach.
 */
export type CompanyIdentity = { profile: CompanyProfile; inherit: boolean };

const scope = new AsyncLocalStorage<CompanyIdentity>();

/** The identity in force, or undefined outside a request. */
export function currentIdentity(): CompanyIdentity | undefined {
  return scope.getStore();
}

/** The profile in force, or undefined outside a request. */
export function currentProfile(): CompanyProfile | undefined {
  return scope.getStore()?.profile;
}

/** Overlay semantics — a blank field inherits. */
export function withCompanyProfile<T>(profile: CompanyProfile | null, fn: () => T): T {
  if (!profile) return fn();
  return scope.run({ profile, inherit: true }, fn);
}

/** Whole-identity semantics — a blank field stays blank. */
export function withCompanyIdentity<T>(identity: CompanyIdentity | null, fn: () => T): T {
  if (!identity) return fn();
  return scope.run(identity, fn);
}

/**
 * Enter the scope for the remainder of THIS async context, without a callback.
 *
 * Used by the tRPC middleware. Wrapping `next()` in a callback instead loses tRPC's
 * context-type inference — the narrowing that makes `ctx.user` non-null in every
 * downstream resolver — and the compiler reported it as five errors in follow-ups.ts
 * rather than anywhere near the cause. A request already has its own async context, so
 * entering it here scopes exactly the request and nothing else.
 */
export function enterCompanyIdentity(identity: CompanyIdentity | null): void {
  if (!identity) return;
  scope.enterWith(identity);
}

/**
 * A short cache, because this would otherwise be a database read on every request.
 *
 * Deliberately short rather than invalidated globally: this process can clear its own
 * entry on write, but a second instance cannot be told, so a stale entry has to age out
 * somewhere. Thirty seconds is the delay between an admin saving their company name and
 * every instance writing with it, which is a fine price for not querying per request.
 */
const TTL_MS = 30_000;
const cache = new Map<number, { at: number; profile: CompanyProfile | null }>();

export function forgetProfile(orgId: number): void {
  cache.delete(orgId);
}

/** For tests, and for anything that needs a guaranteed-fresh read. */
export function clearProfileCache(): void {
  cache.clear();
}

export async function loadProfile(db: any, orgId: number): Promise<CompanyProfile | null> {
  const hit = cache.get(orgId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.profile;

  let profile: CompanyProfile | null = null;
  try {
    if (db) {
      const [row] = await db
        .select({ profile: organizations.profile })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      const raw = row?.profile;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed && typeof parsed === "object") profile = parsed as CompanyProfile;
    }
  } catch {
    // A profile that cannot be read must not take the request down with it — the app
    // falls back to the deployment's identity, which is what it did before this existed.
    profile = null;
  }

  cache.set(orgId, { at: Date.now(), profile });
  return profile;
}

/**
 * What a workspace that has configured nothing writes as.
 *
 * Deliberately obvious placeholders. The alternative for an unconfigured second customer
 * is inheriting the deployment's identity, which is the defect — their outreach going out
 * under the operator's name. A draft that says "Your company" is visibly unfinished and
 * sends the rep to the admin page; a draft that says the operator's name reads as correct
 * and never gets questioned.
 *
 * Only the fields that appear in generated text are placeheld. The rest stay empty, so
 * nothing invents a differentiator or a competitor on a customer's behalf.
 */
export function neutralProfile(): CompanyProfile {
  return {
    companyName: "Your company",
    productName: "Your product",
    companyDescription: "",
    industry: "",
    productDescription: "",
    keyDifferentiators: [],
    targetCustomers: "",
    competitors: "",
  };
}

/**
 * Should this organization inherit the deployment's identity when it has set none?
 *
 * Only the organization that owns the deployment. For anyone else, inheriting would put
 * the operator's company name on their emails — the exact defect — so they get the neutral
 * defaults until they fill their own in, and the admin page asks them to.
 */
export function mayInheritDeploymentIdentity(orgId: number): boolean {
  return orgId === DEFAULT_ORG_ID;
}
