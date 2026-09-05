/**
 * Turning a customer's own spreadsheet into accounts and contacts.
 *
 * `/import` shipped accounts-only, on top of `clayImport.importRawData`. That left the
 * contacts page's empty state pointing at an import that could not produce a contact —
 * a smaller version of the dead end the empty state exists to remove. Real exports are
 * not split that way either: a lead list is one row per person carrying their company
 * beside them, and asking a customer to cut it in half before importing is asking them
 * to do the mapping this is for.
 *
 * The matching here is deliberately stricter than `mapToAccountSchema`, which matches any
 * header CONTAINING "name" or "company" and lets the last such column win. On an account
 * list (`name,domain`) that is right. On a lead list (`First Name,Last Name,Company`) it
 * walks the columns in order and leaves whichever came last in `name` — so an account can
 * end up named "Okonkwo". That function has its own callers and its own contract and is
 * left alone; this path, which is the one a person drives, matches whole header names.
 *
 * Everything here is pure. The row shapes that break an importer — a name column that is
 * a person's on one sheet and a company's on the next, a website with a path on it, an
 * email in a differently-spelled column — are decided here and tested without a database.
 */

export type RawRow = Record<string, unknown>;

export type MappedAccount = {
  /** Lowercased, protocol- and path-stripped. The identity an account is matched on. */
  domain: string;
  name: string;
  extra: Record<string, unknown>;
};

export type MappedContact = {
  /** Lowercased. The identity a contact is matched on. */
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  title: string | null;
  phone: string | null;
  mobilePhone: string | null;
  linkedinUrl: string | null;
  location: string | null;
  department: string | null;
  /** The domain to attach this person to, when the row carried one. */
  domain: string | null;
};

export type MappedRow = {
  account: MappedAccount | null;
  contact: MappedContact | null;
};

/** Header comparison ignores case, spaces, underscores and punctuation. */
function norm(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const EMAIL = new Set([
  "email", "emailaddress", "workemail", "businessemail", "primaryemail",
  "contactemail", "personalemail", "e", "mail",
]);
const FIRST = new Set(["firstname", "fname", "givenname", "first", "forename"]);
const LAST = new Set(["lastname", "lname", "surname", "familyname", "last"]);
const FULLNAME = new Set(["fullname", "contactname", "personname", "displayname"]);
const TITLE = new Set(["title", "jobtitle", "position", "role", "jobrole"]);
const PHONE = new Set(["phone", "phonenumber", "workphone", "directphone", "telephone", "tel"]);
const MOBILE = new Set(["mobile", "mobilephone", "cell", "cellphone", "mobilenumber"]);
const LINKEDIN = new Set(["linkedin", "linkedinurl", "linkedinprofile", "li", "liurl"]);
const LOCATION = new Set(["location", "city", "region", "geo"]);
const DEPARTMENT = new Set(["department", "dept", "function", "team"]);

const DOMAIN = new Set([
  "domain", "website", "websiteurl", "companydomain", "companywebsite",
  "url", "companyurl", "webaddress", "site",
]);
const COMPANY = new Set([
  "company", "companyname", "account", "accountname", "organization",
  "organisation", "employer", "org",
]);

/** A bare `name` column. Whose name it is depends on the row — see mapRow. */
const BARE_NAME = new Set(["name"]);

/**
 * A website as an identity: no scheme, no `www.`, no path, lowercased.
 *
 * Without this, `https://acme.com/` and `acme.com` are two different accounts, so the
 * second import of the same list duplicates every row rather than updating it.
 */
export function normalizeDomain(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const host = withoutScheme.split(/[/?#]/)[0];
  const bare = host.replace(/^www\./i, "").trim().toLowerCase();
  // A cell holding a person's name or a sentence is not a domain. Requiring a dot and
  // no whitespace is enough to keep those out without trying to validate a TLD list.
  if (!bare || /\s/.test(bare) || !bare.includes(".")) return "";
  return bare;
}

/** An address as an identity. Anything without a single @ and a dotted host is not one. */
export function normalizeEmail(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw || /\s/.test(raw)) return "";
  const parts = raw.split("@");
  if (parts.length !== 2) return "";
  const [local, host] = parts;
  if (!local || !host.includes(".") || host.startsWith(".") || host.endsWith(".")) return "";
  return raw;
}

function str(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

/**
 * One row in, up to one account and one contact out.
 *
 * A lead list row produces both — the person, and the company to attach them to. An
 * account list row produces only the account. A row with neither a usable website nor a
 * usable email produces neither, and the caller counts it as skipped rather than writing
 * a record it cannot match on later.
 */
export function mapRow(row: RawRow): MappedRow {
  const buckets: Record<string, unknown> = {};
  const extra: Record<string, unknown> = {};

  let bareName: unknown = undefined;

  for (const [header, value] of Object.entries(row)) {
    const key = norm(header);
    const put = (slot: string) => {
      // First column wins, so a sheet with both "Email" and "Personal Email" keeps the
      // one the author put first rather than whichever happened to come last.
      if (buckets[slot] === undefined || buckets[slot] === null || buckets[slot] === "") {
        buckets[slot] = value;
      }
    };

    if (EMAIL.has(key)) put("email");
    else if (FIRST.has(key)) put("firstName");
    else if (LAST.has(key)) put("lastName");
    else if (FULLNAME.has(key)) put("fullName");
    else if (TITLE.has(key)) put("title");
    else if (MOBILE.has(key)) put("mobilePhone");
    else if (PHONE.has(key)) put("phone");
    else if (LINKEDIN.has(key)) put("linkedinUrl");
    else if (LOCATION.has(key)) put("location");
    else if (DEPARTMENT.has(key)) put("department");
    else if (DOMAIN.has(key)) put("domain");
    else if (COMPANY.has(key)) put("company");
    else if (BARE_NAME.has(key)) bareName = value;
    else extra[header] = value;
  }

  const email = normalizeEmail(buckets.email);
  const domain = normalizeDomain(buckets.domain);

  // Whose name is a bare `name` column? On a lead list it is the person's; on an account
  // list it is the company's. The row itself answers it: if there is an email, there is a
  // person in this row and the name is theirs. Guessing the other way would name every
  // account after whoever was in the first row.
  if (bareName !== undefined) {
    if (email) {
      if (buckets.fullName === undefined) buckets.fullName = bareName;
    } else if (buckets.company === undefined) {
      buckets.company = bareName;
    }
  }

  const first = str(buckets.firstName);
  const last = str(buckets.lastName);
  const full = str(buckets.fullName) ?? (str([first, last].filter(Boolean).join(" ")));

  const companyName = str(buckets.company);

  const account: MappedAccount | null = domain
    ? {
        domain,
        // A domain with no company name still makes a usable account — better named
        // after itself than not imported at all.
        name: companyName ?? domain,
        extra,
      }
    : null;

  const contact: MappedContact | null = email
    ? {
        email,
        firstName: first,
        lastName: last,
        name: full,
        title: str(buckets.title),
        phone: str(buckets.phone),
        mobilePhone: str(buckets.mobilePhone),
        linkedinUrl: str(buckets.linkedinUrl),
        location: str(buckets.location),
        department: str(buckets.department),
        domain: domain || null,
      }
    : null;

  return { account, contact };
}

export type MappedBatch = {
  accounts: MappedAccount[];
  contacts: MappedContact[];
  /** Rows that yielded neither — no usable website and no usable email. */
  skipped: number;
  total: number;
};

/**
 * Map every row, and collapse repeats.
 *
 * A lead list with forty people at one company holds that company forty times. Writing it
 * forty times would be forty round trips to say the same thing, and — because each write
 * would overwrite the last — would make the result depend on row order.
 */
export function mapRows(rows: RawRow[]): MappedBatch {
  const accounts = new Map<string, MappedAccount>();
  const contacts = new Map<string, MappedContact>();
  let skipped = 0;

  for (const row of rows) {
    const { account, contact } = mapRow(row);
    if (!account && !contact) {
      skipped++;
      continue;
    }
    if (account) {
      const seen = accounts.get(account.domain);
      if (!seen) accounts.set(account.domain, account);
      // A later row naming the company beats an earlier one that only had the domain.
      else if (seen.name === seen.domain && account.name !== account.domain) {
        accounts.set(account.domain, account);
      }
    }
    if (contact) contacts.set(contact.email, contact);
  }

  return {
    accounts: [...accounts.values()],
    contacts: [...contacts.values()],
    skipped,
    total: rows.length,
  };
}
