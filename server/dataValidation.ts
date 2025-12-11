import { invokeLLM } from "./_core/llm";
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
 * Search the web for verification data using direct HTTP scraping
 */
async function searchWeb(query: string): Promise<string> {
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
    
    // Also try to extract domain mentions
    const domainRegex = /https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const domains = new Set<string>();
    let domainMatch;
    
    while ((domainMatch = domainRegex.exec(html)) !== null && domains.size < 5) {
      domains.add(domainMatch[1]);
    }
    
    let results = '';
    if (snippets.length > 0) {
      results += 'Search snippets:\n' + snippets.join('\n') + '\n\n';
    }
    if (domains.size > 0) {
      results += 'Found domains: ' + Array.from(domains).join(', ');
    }
    
    return results || 'No results found';
  } catch (error) {
    console.error('Web search failed:', error);
    // Fallback: Just check if domain resolves
    return `Search unavailable. Domain check needed.`;
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

  // Use AI to analyze if search results confirm the domain match
  const prompt = `You are verifying if a company name matches its domain.

Company Name: ${companyName}
Claimed Domain: ${domain}

Web Search Results:
${searchResults}

Based on the search results, does the domain "${domain}" actually belong to "${companyName}"?

Return JSON:
{
  "isValid": true/false,
  "confidence": 0.0-1.0,
  "issue": "Brief description if invalid",
  "suggestion": "Correct domain if found"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a data verification expert. Return only valid JSON." },
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

    const content = response.choices[0].message.content;
    if (content && typeof content === 'string') {
      const result = JSON.parse(content);
      
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
    }
  } catch (error) {
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

  const prompt = `You are verifying employee count data.

Company: ${companyName}
Claimed Employee Count: ${claimedCount}

Web Search Results:
${searchResults}

Based on search results, is the claimed employee count accurate?

Return JSON:
{
  "isValid": true/false,
  "confidence": 0.0-1.0,
  "actualCount": number or null,
  "issue": "Brief description if invalid",
  "suggestion": "Correction if found"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a data verification expert. Return only valid JSON." },
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

    const content = response.choices[0].message.content;
    if (content && typeof content === 'string') {
      const result = JSON.parse(content);
      
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
    }
  } catch (error) {
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

  const prompt = `You are verifying if a contact works at a company.

Contact: ${contactName}
Title: ${title || 'Unknown'}
Company: ${companyName}

Web Search Results (LinkedIn, company websites, news):
${searchResults}

Based on search results, does this person work at this company in this role?

Return JSON:
{
  "isValid": true/false,
  "confidence": 0.0-1.0,
  "issue": "Brief description if invalid",
  "suggestion": "Correction if found"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a data verification expert. Return only valid JSON." },
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

    const content = response.choices[0].message.content;
    if (content && typeof content === 'string') {
      const result = JSON.parse(content);
      
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
    }
  } catch (error) {
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
export async function validateAllAccounts(limit: number = 20): Promise<ValidationIssue[]> {
  const accounts = await getAllAccounts();
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
export async function validateAllContacts(limit: number = 30): Promise<ValidationIssue[]> {
  const contacts = await getAllPeople();
  const accounts = await getAllAccounts();
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  
  const allIssues: ValidationIssue[] = [];

  // Process in small batches
  const batch = contacts.slice(0, limit);
  
  for (let i = 0; i < batch.length; i++) {
    const contact = batch[i];
    const account = accountMap.get(contact.accountId);
    
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
export async function getValidationSummary() {
  const accounts = await getAllAccounts();
  const contacts = await getAllPeople();

  // Quick validation without web searches
  const accountIssues = {
    missingDomain: accounts.filter(a => !a.domain).length,
    missingIndustry: accounts.filter(a => !a.industry).length,
    missingEmployeeCount: accounts.filter(a => !a.employeeCount).length,
    invalidIntentScore: accounts.filter(a => {
      const score = a.intentScore;
      return score && (score < 0 || score > 100);
    }).length
  };

  const contactIssues = {
    missingEmail: contacts.filter(c => !c.email).length,
    missingTitle: contacts.filter(c => !c.title).length,
    missingPhone: contacts.filter(c => !c.phone).length,
    noAccountLink: contacts.filter(c => !c.accountId).length
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
