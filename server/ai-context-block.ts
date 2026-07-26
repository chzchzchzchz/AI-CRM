/**
 * Structured context for prompts.
 *
 * Every caller used to hand-concatenate its own facts into a task string, which
 * meant three things went wrong at once: no two prompts agreed on which facts
 * mattered, values arrived unlabelled so the model had to guess what a bare
 * number meant, and nothing told the model where the facts stopped — so it
 * filled the gaps.
 *
 * This renders any structured input into one labelled, deterministic block and
 * states the boundary explicitly. It is the same discipline `validateJudgement`
 * applies after generation, moved to before it: the model is told what is
 * known, and told to say "not available" rather than invent the rest.
 */

export type ContextValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ContextValue[]
  | { [key: string]: ContextValue };

export type ContextInput = Record<string, ContextValue>;

/** Turns camelCase / snake_case keys into a readable label. */
function label(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isEmpty(v: ContextValue): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false;
}

function renderValue(v: ContextValue, depth: number): string[] {
  const pad = "  ".repeat(depth);

  if (isEmpty(v)) return [`${pad}(not available)`];
  if (Array.isArray(v)) {
    // Flat arrays of scalars read better inline than as a bullet per item.
    if (v.every(x => x === null || typeof x !== "object")) {
      return [`${pad}${v.filter(x => !isEmpty(x)).join(", ")}`];
    }
    return v.flatMap((item, i) => [`${pad}- [${i + 1}]`, ...renderValue(item, depth + 1)]);
  }
  if (typeof v === "object" && v !== null) {
    return Object.entries(v).flatMap(([k, val]) =>
      isEmpty(val)
        ? []
        : typeof val === "object" && val !== null
          ? [`${pad}${label(k)}:`, ...renderValue(val as ContextValue, depth + 1)]
          : [`${pad}${label(k)}: ${String(val)}`]
    );
  }
  return [`${pad}${String(v)}`];
}

/**
 * Render a context object as a labelled FACTS block.
 *
 * Empty values are rendered as an explicit "(not available)" rather than being
 * dropped, so an absent field reads as a known gap instead of looking like it
 * was never asked for.
 */
export function renderContext(input: ContextInput): string {
  const sections = Object.entries(input)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => {
      const body = renderValue(value, 1).join("\n");
      return `### ${label(key)}\n${body}`;
    });

  if (!sections.length) return "";
  return sections.join("\n\n");
}

/**
 * The instruction that makes the block binding. Without it the facts are
 * merely suggestions and the model will still fill gaps from its priors.
 */
export const GROUNDING_RULE = `## GROUNDING (non-negotiable)

The FACTS section below is the complete set of verified data available for this
request. It came from the customer's own CRM and enrichment providers.

- Use only what appears in FACTS. Do not add companies, people, numbers, dates,
  job titles, or events that are not there.
- A field marked "(not available)" is genuinely unknown. Say so plainly. Never
  substitute a plausible value, and never describe a gap as if it were data.
- When you make a claim, it must be traceable to a specific line in FACTS.
- If FACTS is insufficient to answer, say what is missing instead of guessing.

Being useful about what is known beats being complete about what is not.`;

/**
 * Compose a task with its structured context.
 *
 * Kept separate from the persona helpers so any prompt — persona or not — can
 * be grounded the same way.
 */
export function withFacts(taskContext: string, facts?: ContextInput): string {
  if (!facts || Object.keys(facts).length === 0) return taskContext;
  const block = renderContext(facts);
  if (!block) return taskContext;
  return `${GROUNDING_RULE}\n\n---\n\n${taskContext}\n\n---\n\n## FACTS\n\n${block}`;
}
