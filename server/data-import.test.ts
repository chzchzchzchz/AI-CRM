import { describe, it, expect } from "vitest";
import { mapRow, mapRows, normalizeDomain, normalizeEmail } from "./_core/data-import";

/**
 * What a customer's actual spreadsheet does to an importer.
 *
 * These are the shapes that break one: a `name` column that means a person on one sheet
 * and a company on the next, a website with a scheme and a path, forty people at one
 * company, a row with nothing to match on. Every one of them produces a plausible-looking
 * import if it is guessed at — an account named after a sales rep, the same company forty
 * times, a contact nobody can find again.
 */

describe("normalizeDomain", () => {
  it("reduces a website to the identity an account is matched on", () => {
    // Without this, https://acme.com/careers and acme.com are two accounts, so the
    // second import of the same list duplicates every row instead of updating it.
    for (const written of [
      "acme.com",
      "ACME.com",
      "www.acme.com",
      "https://acme.com",
      "http://www.acme.com/",
      "https://acme.com/careers?utm=x",
      "  acme.com  ",
    ]) {
      expect(normalizeDomain(written), written).toBe("acme.com");
    }
  });

  it("refuses things that are not websites", () => {
    // A "Company" column holding "Acme Corporation" must not become the domain
    // acme corporation — it would match nothing, forever, under a plausible name.
    for (const notADomain of ["", "   ", "Acme Corporation", "acme", "not a domain", null, undefined]) {
      expect(normalizeDomain(notADomain as any), String(notADomain)).toBe("");
    }
  });

  it("keeps subdomains, which are real companies", () => {
    expect(normalizeDomain("careers.acme.co.uk")).toBe("careers.acme.co.uk");
  });
});

describe("normalizeEmail", () => {
  it("accepts an ordinary address, lowercased", () => {
    expect(normalizeEmail("Jordan.Bailey@Acme.com")).toBe("jordan.bailey@acme.com");
  });

  it("refuses anything that cannot be an identity", () => {
    for (const bad of ["", "jordan", "jordan@", "@acme.com", "a@b", "two@at@signs.com", "has space@acme.com"]) {
      expect(normalizeEmail(bad), bad).toBe("");
    }
  });
});

describe("mapRow", () => {
  it("reads an account list", () => {
    const { account, contact } = mapRow({ name: "Acme Corp", domain: "acme.com" });
    expect(account).toMatchObject({ name: "Acme Corp", domain: "acme.com" });
    expect(contact).toBeNull();
  });

  it("reads a lead list row as a person AND their company", () => {
    // One row, both records. Splitting the sheet by hand first is the mapping work this
    // is supposed to do.
    const { account, contact } = mapRow({
      "First Name": "Jordan",
      "Last Name": "Okonkwo",
      "Job Title": "VP Engineering",
      "Work Email": "jordan@acme.com",
      Company: "Acme Corp",
      Website: "https://www.acme.com/",
    });
    expect(account).toMatchObject({ name: "Acme Corp", domain: "acme.com" });
    expect(contact).toMatchObject({
      email: "jordan@acme.com",
      firstName: "Jordan",
      lastName: "Okonkwo",
      name: "Jordan Okonkwo",
      title: "VP Engineering",
      domain: "acme.com",
    });
  });

  it("decides whose a bare `name` column is from the row itself", () => {
    // The ambiguity that names an account after a person. mapToAccountSchema matches any
    // header CONTAINING "name" and lets the last one win, so on a lead list an account
    // could end up called "Okonkwo". A row with an email has a person in it, so the name
    // is theirs; a row without one is a company.
    const lead = mapRow({ name: "Jordan Okonkwo", email: "jordan@acme.com", domain: "acme.com" });
    expect(lead.contact?.name).toBe("Jordan Okonkwo");
    expect(lead.account?.name).toBe("acme.com");

    const company = mapRow({ name: "Acme Corp", domain: "acme.com" });
    expect(company.account?.name).toBe("Acme Corp");
    expect(company.contact).toBeNull();
  });

  it("names an account after its domain rather than dropping it", () => {
    const { account } = mapRow({ website: "acme.com" });
    expect(account).toMatchObject({ name: "acme.com", domain: "acme.com" });
  });

  it("keeps a contact whose company has no website", () => {
    // accountId is nullable by design. Inventing an account from a name with no domain
    // would create a second, unmatchable copy of a company the customer already has.
    const { account, contact } = mapRow({ email: "jordan@acme.com", company: "Acme Corp" });
    expect(account).toBeNull();
    expect(contact).toMatchObject({ email: "jordan@acme.com", domain: null });
  });

  it("yields nothing from a row with nothing to match on", () => {
    // Counted as skipped by the caller. Writing it would create a record that can never
    // be found or updated again.
    expect(mapRow({ Notes: "follow up next quarter", Owner: "Sam" })).toEqual({
      account: null,
      contact: null,
    });
  });

  it("matches headers however they are spelled", () => {
    const { contact } = mapRow({
      "E-Mail Address": "jordan@acme.com",
      "  first_name ": "Jordan",
      MOBILE: "+1 555 0100",
      LinkedIn_URL: "https://linkedin.com/in/jordan",
    });
    expect(contact).toMatchObject({
      email: "jordan@acme.com",
      firstName: "Jordan",
      mobilePhone: "+1 555 0100",
      linkedinUrl: "https://linkedin.com/in/jordan",
    });
  });

  it("keeps the first of two columns that mean the same thing", () => {
    // A sheet with both "Email" and "Personal Email" keeps the one the author put first,
    // rather than whichever happened to be last in the row.
    const { contact } = mapRow({ Email: "work@acme.com", "Personal Email": "home@example.com" });
    expect(contact?.email).toBe("work@acme.com");
  });

  it("keeps unrecognised columns instead of discarding them", () => {
    const { account } = mapRow({ domain: "acme.com", "ARR Band": "$1-5M" });
    expect(account?.extra).toEqual({ "ARR Band": "$1-5M" });
  });

  it("does not mistake a phone column for a mobile one, or the reverse", () => {
    const { contact } = mapRow({
      email: "jordan@acme.com",
      "Direct Phone": "+1 555 0111",
      "Mobile Phone": "+1 555 0222",
    });
    expect(contact?.phone).toBe("+1 555 0111");
    expect(contact?.mobilePhone).toBe("+1 555 0222");
  });
});

describe("mapRows", () => {
  it("collapses one company repeated across a lead list", () => {
    // Forty people at Acme is one account, not forty writes of the same row — and forty
    // writes would make the stored name depend on which row came last.
    const rows = Array.from({ length: 40 }, (_, i) => ({
      email: `person${i}@acme.com`,
      company: "Acme Corp",
      domain: "acme.com",
    }));
    const batch = mapRows(rows);
    expect(batch.accounts).toHaveLength(1);
    expect(batch.contacts).toHaveLength(40);
    expect(batch.total).toBe(40);
    expect(batch.skipped).toBe(0);
  });

  it("prefers a row that names the company over one that only had the domain", () => {
    const batch = mapRows([{ website: "acme.com" }, { company: "Acme Corp", website: "acme.com" }]);
    expect(batch.accounts).toEqual([
      expect.objectContaining({ domain: "acme.com", name: "Acme Corp" }),
    ]);
  });

  it("collapses a person listed twice", () => {
    const batch = mapRows([
      { email: "jordan@acme.com", "first name": "Jordan" },
      { email: "JORDAN@acme.com", "job title": "VP Engineering" },
    ]);
    expect(batch.contacts).toHaveLength(1);
  });

  it("counts rows it could not use rather than quietly dropping them", () => {
    // The number that makes a failed import legible: 3 rows read, 0 written, 3 skipped
    // says "your domain column is named something else", where a bare success does not.
    const batch = mapRows([
      { Notes: "call back" },
      { domain: "acme.com" },
      { Owner: "Sam" },
    ]);
    expect(batch.total).toBe(3);
    expect(batch.skipped).toBe(2);
    expect(batch.accounts).toHaveLength(1);
  });
});
