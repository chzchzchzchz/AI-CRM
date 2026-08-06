/**
 * Is this JWT_SECRET a placeholder rather than a secret?
 *
 * There was already a check for this. It compared against the literal string
 * "change-this-to-a-long-random-string" — a value that appears nowhere in this
 * repository. The placeholder `.env.example` actually ships is
 *
 *   JWT_SECRET=dev-only-insecure-secret-replace-me-with-openssl-rand-base64-48
 *
 * which is 61 characters, so it cleared the length test, and is not the one string the
 * check knew about, so it cleared that too. Following the documented setup — `cp
 * .env.example .env` — and deploying with DEMO_MODE=false therefore signed real session
 * cookies with a key printed in a public repo. Anyone who had read the README could
 * mint a session for any account.
 *
 * The guard existed, read as if it worked, and protected against a string nobody had.
 *
 * Matching on markers rather than one exact value means the next placeholder someone
 * invents is caught without anyone remembering to add it here.
 */

/** Words that only appear in a value nobody has replaced yet. */
const PLACEHOLDER_MARKERS = [
  "change-this",
  "changeme",
  "change_me",
  "replace-me",
  "replace_me",
  "replaceme",
  "dev-only",
  "insecure",
  "your-secret",
  "your_secret",
  "example",
  "placeholder",
  "todo",
  "xxxx",
];

/** Shortest secret worth signing with. */
export const MIN_SECRET_LENGTH = 16;

/**
 * True when this value must not be used to sign sessions.
 *
 * Length alone is not enough: a long placeholder is still public. Markers alone are not
 * enough either: a short random string is still guessable.
 */
export function isWeakSecret(secret: string | undefined | null): boolean {
  if (!secret) return true;
  const s = secret.trim();
  if (s.length < MIN_SECRET_LENGTH) return true;
  const lower = s.toLowerCase();
  return PLACEHOLDER_MARKERS.some((m) => lower.includes(m));
}

/** What to tell someone whose secret was rejected. */
export const WEAK_SECRET_MESSAGE =
  "JWT_SECRET is missing, too short, or still the placeholder from .env.example. " +
  "Generate one with `openssl rand -base64 48` before running outside demo mode — " +
  "the shipped value is public, so sessions signed with it are forgeable by anyone.";
