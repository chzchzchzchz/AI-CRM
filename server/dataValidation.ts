import { wrapUntrusted, INJECTION_GUARD } from "./_core/untrusted";
import { invokeLLM, llmText, parseLlmJson } from "./_core/llm";
import { withRCP } from "./ai-system-prompt";
import { getAllAccounts, getAllPeople } from "./db";

/**
 * Web search-based data validation
 * Uses actual web searches and APIs to VERIFY truth, not AI guessing
 */

export interface ValidationIssue {
  id: string;
  type: 'account' | 'contact' | 'relationship';
  severity: 'critical' | 'warning' | 'info';
  entityId: number;
  entityName: string;
  field: string;
  issue: string;
  suggestion: string;
  confidence: number;
  searchResults?: string; // Evidence from web search
  lastChecked: Date;
}

export interface ValidationCache {
  entityType: 'account' | 'contact';
  entityId: number;
  field: string;
  isValid: boolean;
  issue?: string;
  suggestion?: string;
  evidence?: string;
  checkedAt: Date;
}

/**
 * Sentinel returned by searchWeb when the scrape produced nothing usable — no snippet
 * text and no domains beyond the search engine's own chrome (support pages, consent
 * links, etc). Callers must treat this as "we don't know", never as "we checked and
 * it's wrong": Google's result markup changes without notice (it did — the old
 * `BNeawe`-class snippet regex now matches zero results, silently), and on a break
 * like that the domain regex still "succeeds" by picking up google.com/support.google.com
 * links from the page's own furniture. Handing that to the model as "evidence" gets a
 * confident, fabricated verdict against real, correct data — the exact failure mode
 * the product's "every number is real and shows its work" promise exists to prevent.
 */
export const NO_SEARCH_EVIDENCE = "NO_SEARCH_EVIDENCE";

/**
 * Tracks how many searchWeb() calls came back empty during the current validation run,
 * so a caller can tell "checked and found clean" apart from "couldn't check" — the
 * latter must never render as "passed verification". Module-level rather than threaded
 * through every function signature: this app runs one bulk validation at a time, so the
 * simplicity is worth the (accepted) risk of cross-contamination between two concurrent
 * validation runs, which nothing in this UI currently allows a single user to trigger.
 * JS's single-threaded execution means the increments themselves are never racy.
 */
export const searchEvidenceStats = { checked: 0, noEvidence: 0 };
export function resetSearchEvidenceStats(): void {
  searchEvidenceStats.checked = 0;
  searchEvidenceStats.noEvidence = 0;
}

/**
 * Same problem as searchEvidenceStats, one layer downstream: web evidence can come back
 * fine and the MODEL call that reasons over it can still fail (no key configured, Forge
 * rate-limited or down — invokeLLM throws rather than degrades on some failures; see
 * _core/llm.ts). Every verify* function below used to let that fall through to the same
 * `return null` as "checked the evidence, found nothing wrong" — isLlmUnavailable was
 * imported and never actually called anywhere in this file. A rep verifying a flagged
 * record during a Forge outage saw a confident "Verified — nothing contradicted by the
 * web," not "the check didn't run."
 */
export const llmEvidenceStats = { checked: 0, unavailable: 0 };
export function resetLlmEvidenceStats(): void {
  llmEvidenceStats.checked = 0;
  llmEvidenceStats.unavailable = 0;
}

// Domains that can show up in a scraped results page without being an actual result —
// the search engine's own chrome, consent screens, and support pages.
const SEARCH_ENGINE_OWN_DOMAINS = new Set([
  "google.com", "www.google.com", "support.google.com", "accounts.google.com",
  "policies.google.com", "consent.google.com", "duckduckgo.com", "html.duckduckgo.com",
]);

/**
 * Search the web for verification data using direct HTTP scraping.
 *
 * No search API key is configured for this app, so this scrapes a public search
 * results page. That's inherently fragile — the target site can change its markup,
 * rate-limit, or serve a JS-rendered shell with no static content — so the result is
 * always checked for usable evidence before being trusted. When there isn't any, this
 * returns NO_SEARCH_EVIDENCE rather than an empty-looking string that a caller might
 * mistake for "checked, found nothing wrong."
 */
async function searchWeb(query: string): Promise<string> {
  searchEvidenceStats.checked++;
  try {
    // Use Google search HTML scraping (no API key needed)
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Extract search result snippets using regex
    const snippetRegex = /<div class="[^"]*BNeawe[^"]*"[^>]*>([^<]+)<\/div>/g;
    const snippets: string[] = [];
    let match;

    while ((match = snippetRegex.exec(html)) !== null && snippets.length < 10) {
      const text = match[1].trim();
      if (text.length > 20 && !snippets.includes(text)) {
        snippets.push(text);
      }
    }

    // Also try to extract domain mentions — excluding the search engine's own domains,
    // which show up on every page regardless of query and are not a "result".
    const domainRegex = /https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const domains = new Set<string>();
    let domainMatch;

    while ((domainMatch = domainRegex.exec(html)) !== null && domains.size < 5) {
      const domain = domainMatch[1].toLowerCase();
      if (!SEARCH_ENGINE_OWN_DOMAINS.has(domain)) {
        domains.add(domainMatch[1]);
      }
    }

    let results = '';
    if (snippets.length > 0) {
      results += 'Search snippets:\n' + snippets.join('\n') + '\n\n';
    }
    if (domains.size > 0) {
      results += 'Found domains: ' + Array.from(domains).join(', ');
    }

    if (!results) searchEvidenceStats.noEvidence++;
    return results || NO_SEARCH_EVIDENCE;
  } catch (error) {
    console.error('Web search failed:', error);
    searchEvidenceStats.noEvidence++;
    return NO_SEARCH_EVIDENCE;
  }
}

/**
 * Verify company name matches domain using web search
 */
async function verifyCompanyDomain(companyName: string, domain: string | null): Promise<ValidationIssue | null> {
  if (!domain) {
    return null; // Missing domain is a different issue
  }

  // Search for "CompanyName official website"
  const searchQuery = `${companyName} official website domain`;
  const searchResults = await searchWeb(searchQuery);

  // No real evidence to reason from — asking the model to render a verdict here would
  // just be guessing dressed up as verification. Say nothing rather than say something
  // false with a confident-looking percentage attached.
  if (searchResults === NO_SEARCH_EVIDENCE) return null;

  // Use AI to analyze if search results confirm the domain match
  const prompt = `You are verifying if a company name matches its domain.

Company Name: ${companyName}
Claimed Domain: ${domain}

${wrapUntrusted("web search results", searchResults)}

Based on the search results, does the domain "${domain}" actually belong to "${companyName}"?

Return JSON:
{
  "isValid": true/false,
  "confidence": 0.0-1.0,
  "issue": "Brief description if invalid",
  "suggestion": "Correct domain if found"
}`;

  llmEvidenceStats.checked++;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: withRCP("You are a data verification expert. Return only valid JSON.") },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "domain_verification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              isValid: { type: "boolean" },
              confidence: { type: "number" },
              issue: { type: "string" },
              suggestion: { type: "string" }
            },
            required: ["isValid", "confidence", "issue", "suggestion"],
            additionalProperties: false
          }
        }
      }
    });

    // Parsing the degradation note gives an object with no isValid field, which reads
    // as "not invalid" and quietly passes every record through as clean.
    const { content, available } = llmText(response);
    if (!available) {
      llmEvidenceStats.unavailable++;
      return null;
    }

    const result = parseLlmJson<any>(content);

    if (!result.isValid) {
      return {
        id: `domain-mismatch-${companyName}`,
        type: 'account',
        severity: 'critical',
        entityId: 0, // Will be set by caller
        entityName: companyName,
        field: 'domain',
        issue: result.issue,
        suggestion: result.suggestion,
        confidence: result.confidence,
        searchResults: searchResults.substring(0, 500),
        lastChecked: new Date()
      };
    }
  } catch (error) {
    llmEvidenceStats.unavailable++;
    console.error('Domain verification failed:', error);
  }

  return null;
}

/**
 * Verify employee count is reasonable using web search
 */
async function verifyEmployeeCount(companyName: string, claimedCount: number | null): Promise<ValidationIssue | null> {
  if (!claimedCount) {
    return null;
  }

  // Search for company employee count
  const searchQuery = `${companyName} number of employees 2024`;
  const searchResults = await searchWeb(searchQuery);

  if (searchResults === NO_SEARCH_EVIDENCE) return null;

  const prompt = `You are verifying employee count data.

Company: ${companyName}
Claimed Employee Count: ${claimedCount}

${wrapUntrusted("web search results", searchResults)}

Based on search results, is the claimed employee count accurate?

Return JSON:
{
  "isValid": true/false,
  "confidence": 0.0-1.0,
  "actualCount": number or null,
  "issue": "Brief description if invalid",
  "suggestion": "Correction if found"
}`;

  llmEvidenceStats.checked++;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: withRCP("You are a data verification expert. Return only valid JSON.") },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "employee_verification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              isValid: { type: "boolean" },
              confidence: { type: "number" },
              actualCount: { type: ["number", "null"] },
              issue: { type: "string" },
              suggestion: { type: "string" }
            },
            required: ["isValid", "confidence", "actualCount", "issue", "suggestion"],
            additionalProperties: false
          }
        }
      }
    });

    // Parsing the degradation note gives an object with no isValid field, which reads
    // as "not invalid" and quietly passes every record through as clean.
    const { content, available } = llmText(response);
    if (!available) {
      llmEvidenceStats.unavailable++;
      return null;
    }

    const result = parseLlmJson<any>(content);

    if (!result.isValid && result.confidence > 0.6) {
      return {
        id: `employee-count-${companyName}`,
        type: 'account',
        severity: 'warning',
        entityId: 0,
        entityName: companyName,
        field: 'employeeCount',
        issue: result.issue,
        suggestion: result.suggestion,
        confidence: result.confidence,
        searchResults: searchResults.substring(0, 500),
        lastChecked: new Date()
      };
    }
  } catch (error) {
    llmEvidenceStats.unavailable++;
    console.error('Employee count verification failed:', error);
  }

  return null;
}

/**
 * Verify contact actually works at company using web search
 */
async function verifyContactEmployment(
  contactName: string,
  title: string | null,
  companyName: string
): Promise<ValidationIssue | null> {
  // Search for contact at company
  const searchQuery = `"${contactName}" ${title || ''} ${companyName} LinkedIn`;
  const searchResults = await searchWeb(searchQuery);

  if (searchResults === NO_SEARCH_EVIDENCE) return null;

  const prompt = `You are verifying if a contact works at a company.

Contact: ${contactName}
Title: ${title || 'Unknown'}
Company: ${companyName}

${wrapUntrusted("web search results", searchResults)}

Based on search results, does this person work at this company in this role?

Return JSON:
{
  "isValid": true/false,
  "confidence": 0.0-1.0,
  "issue": "Brief description if invalid",
  "suggestion": "Correction if found"
}`;

  llmEvidenceStats.checked++;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: withRCP("You are a data verification expert. Return only valid JSON.") },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "employment_verification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              isValid: { type: "boolean" },
              confidence: { type: "number" },
              issue: { type: "string" },
              suggestion: { type: "string" }
            },
            required: ["isValid", "confidence", "issue", "suggestion"],
            additionalProperties: false
          }
        }
      }
    });

    // Parsing the degradation note gives an object with no isValid field, which reads
    // as "not invalid" and quietly passes every record through as clean.
    const { content, available } = llmText(response);
    if (!available) {
      llmEvidenceStats.unavailable++;
      return null;
    }

    const result = parseLlmJson<any>(content);

    if (!result.isValid && result.confidence > 0.7) {
      return {
        id: `employment-${contactName}-${companyName}`,
        type: 'contact',
        severity: 'critical',
        entityId: 0,
        entityName: contactName,
        field: 'accountId',
        issue: result.issue,
        suggestion: result.suggestion,
        confidence: result.confidence,
        searchResults: searchResults.substring(0, 500),
        lastChecked: new Date()
      };
    }
  } catch (error) {
    llmEvidenceStats.unavailable++;
    console.error('Employment verification failed:', error);
  }

  return null;
}

/**
 * Validate email domain matches company domain
 */
function validateEmailDomain(email: string | null, companyDomain: string | null): ValidationIssue | null {
  if (!email || !companyDomain) {
    return null;
  }

  const emailDomain = email.split('@')[1]?.toLowerCase();
  const normalizedCompanyDomain = companyDomain.toLowerCase().replace(/^www\./, '');

  if (emailDomain !== normalizedCompanyDomain) {
    return {
      id: `email-domain-mismatch-${email}`,
      type: 'contact',
      severity: 'warning',
      entityId: 0,
      entityName: email,
      field: 'email',
      issue: `Email domain "${emailDomain}" doesn't match company domain "${normalizedCompanyDomain}"`,
      suggestion: `Expected email to end with @${normalizedCompanyDomain}`,
      confidence: 1.0,
      lastChecked: new Date()
    };
  }

  return null;
}

/**
 * Validate a single account with web search verification
 */
export async function validateAccount(account: any): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Verify domain matches company name
  const domainIssue = await verifyCompanyDomain(account.name, account.domain);
  if (domainIssue) {
    domainIssue.entityId = account.id;
    issues.push(domainIssue);
  }

  // Verify employee count
  const employeeIssue = await verifyEmployeeCount(account.name, account.employeeCount);
  if (employeeIssue) {
    employeeIssue.entityId = account.id;
    issues.push(employeeIssue);
  }

  // Check for obviously invalid data
  if (account.intentScore && (account.intentScore < 0 || account.intentScore > 100)) {
    issues.push({
      id: `intent-score-${account.id}`,
      type: 'account',
      severity: 'critical',
      entityId: account.id,
      entityName: account.name,
      field: 'intentScore',
      issue: `Intent score ${account.intentScore} is outside valid range (0-100)`,
      suggestion: 'Set to null or correct value between 0-100',
      confidence: 1.0,
      lastChecked: new Date()
    });
  }

  return issues;
}

/**
 * Validate a single contact with web search verification
 */
export async function validateContact(contact: any, account: any): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Verify contact works at company (only if we have enough info)
  if (contact.name && account?.name) {
    const employmentIssue = await verifyContactEmployment(
      contact.name,
      contact.title,
      account.name
    );
    if (employmentIssue) {
      employmentIssue.entityId = contact.id;
      issues.push(employmentIssue);
    }
  }

  // Validate email domain matches company domain
  const emailIssue = validateEmailDomain(contact.email, account?.domain);
  if (emailIssue) {
    emailIssue.entityId = contact.id;
    issues.push(emailIssue);
  }

  return issues;
}

/**
 * Validate all accounts (batch processing with rate limiting)
 */
export async function validateAllAccounts(orgId: number, limit: number = 20): Promise<ValidationIssue[]> {
  const accounts = await getAllAccounts(orgId);
  const allIssues: ValidationIssue[] = [];

  // Process in small batches to avoid rate limiting
  const batch = accounts.slice(0, limit);
  
  for (let i = 0; i < batch.length; i++) {
    const account = batch[i];
    console.log(`Validating account ${i + 1}/${batch.length}: ${account.name}`);
    
    const issues = await validateAccount(account);
    allIssues.push(...issues);
    
    // Rate limiting: wait 2 seconds between requests
    if (i < batch.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return allIssues;
}

/**
 * Validate all contacts (batch processing with rate limiting)
 */
export async function validateAllContacts(orgId: number, limit: number = 30): Promise<ValidationIssue[]> {
  const contacts = await getAllPeople(orgId);
  const accounts = await getAllAccounts(orgId);
  const accountMap = new Map(accounts.map((a: any) => [a.id, a]));
  
  const allIssues: ValidationIssue[] = [];

  // Process in small batches
  const batch = contacts.slice(0, limit);
  
  for (let i = 0; i < batch.length; i++) {
    const contact = batch[i];
    const account = contact.accountId ? accountMap.get(contact.accountId) : undefined;
    
    console.log(`Validating contact ${i + 1}/${batch.length}: ${contact.name}`);
    
    const issues = await validateContact(contact, account);
    allIssues.push(...issues);
    
    // Rate limiting: wait 2 seconds between requests
    if (i < batch.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return allIssues;
}

/**
 * Get validation summary statistics (quick, no web searches)
 */
export async function getValidationSummary(orgId: number) {
  const accounts = await getAllAccounts(orgId);
  const contacts = await getAllPeople(orgId);

  // Quick validation without web searches
  const accountIssues = {
    missingDomain: accounts.filter((a: any) => !a.domain).length,
    missingIndustry: accounts.filter((a: any) => !a.industry).length,
    missingEmployeeCount: accounts.filter((a: any) => !a.employeeCount).length,
    invalidIntentScore: accounts.filter((a: any) => {
      const score = a.intentScore;
      return score && (score < 0 || score > 100);
    }).length
  };

  const contactIssues = {
    missingEmail: contacts.filter((c: any) => !c.email).length,
    missingTitle: contacts.filter((c: any) => !c.title).length,
    missingPhone: contacts.filter((c: any) => !c.phone).length,
    noAccountLink: contacts.filter((c: any) => !c.accountId).length
  };

  return {
    totalAccounts: accounts.length,
    totalContacts: contacts.length,
    accountIssues,
    contactIssues,
    totalIssues: Object.values(accountIssues).reduce((a, b) => a + b, 0) +
                  Object.values(contactIssues).reduce((a, b) => a + b, 0)
  };
}
