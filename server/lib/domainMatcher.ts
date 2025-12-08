/**
 * Domain Matching Utilities
 * Smart domain extraction and normalization for perfect contact-to-account mapping
 */

/**
 * Extract domain from email address
 */
export function extractDomainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const parts = email.toLowerCase().trim().split('@');
  if (parts.length !== 2) return null;
  return parts[1];
}

/**
 * Extract domain from URL/website
 */
export function extractDomainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const cleaned = url.toLowerCase().trim();
    // Add protocol if missing
    const withProtocol = cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
    const urlObj = new URL(withProtocol);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    // If URL parsing fails, try simple extraction
    const match = url.toLowerCase().match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z0-9.-]+)/i);
    return match ? match[1] : null;
  }
}

/**
 * Normalize domain (remove www, lowercase, trim)
 */
export function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  return domain.toLowerCase().trim().replace(/^www\./, '');
}

/**
 * Generate domain variations for a company
 * Examples:
 * - ultimatesoftware.com → [ultimatesoftware.com, ukg.com, kronos.com]
 * - stryker.com → [stryker.com, stryker.co.uk, stryker.eu]
 */
export function generateDomainVariations(
  primaryDomain: string | null,
  website: string | null,
  name: string | null
): string[] {
  const variations = new Set<string>();
  
  // Add primary domain
  if (primaryDomain) {
    const normalized = normalizeDomain(primaryDomain);
    if (normalized) variations.add(normalized);
  }
  
  // Extract from website
  if (website) {
    const extracted = extractDomainFromUrl(website);
    if (extracted) variations.add(extracted);
  }
  
  // Generate from company name
  if (name) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .trim();
    
    if (slug) {
      // Common TLDs
      variations.add(`${slug}.com`);
      variations.add(`${slug}.io`);
      
      // Handle known company variations
      const knownVariations = getKnownCompanyVariations(name);
      knownVariations.forEach(v => variations.add(v));
    }
  }
  
  return Array.from(variations).filter(Boolean);
}

/**
 * Known company domain variations (hardcoded mappings for common cases)
 */
function getKnownCompanyVariations(companyName: string): string[] {
  const name = companyName.toLowerCase();
  const variations: string[] = [];
  
  // UKG / Ultimate Software / Kronos
  if (name.includes('ultimate') || name.includes('ukg') || name.includes('kronos')) {
    variations.push('ultimatesoftware.com', 'ukg.com', 'kronos.com');
  }
  
  // Stryker
  if (name.includes('stryker')) {
    variations.push('stryker.com', 'stryker.co.uk', 'stryker.eu');
  }
  
  // HSBC
  if (name.includes('hsbc')) {
    variations.push('hsbc.com', 'hsbc.co.uk', 'hsbc.com.hk');
  }
  
  // Databricks
  if (name.includes('databricks')) {
    variations.push('databricks.com');
  }
  
  // Add more known variations as needed
  
  return variations;
}

/**
 * Check if an email domain matches any of the account's domain variations
 */
export function matchEmailToAccount(
  email: string | null,
  accountDomain: string | null,
  accountDomainVariations: string[] | null
): boolean {
  const emailDomain = extractDomainFromEmail(email);
  if (!emailDomain) return false;
  
  // Check primary domain
  if (accountDomain && normalizeDomain(emailDomain) === normalizeDomain(accountDomain)) {
    return true;
  }
  
  // Check domain variations
  if (accountDomainVariations && Array.isArray(accountDomainVariations)) {
    const normalizedEmail = normalizeDomain(emailDomain);
    return accountDomainVariations.some(
      variation => normalizeDomain(variation) === normalizedEmail
    );
  }
  
  return false;
}

/**
 * Find best matching account for a contact email
 * Returns account ID or null
 */
export function findAccountByEmail(
  email: string | null,
  accounts: Array<{
    id: number;
    domain: string | null;
    domainVariations: string[] | null;
  }>
): number | null {
  if (!email) return null;
  
  const emailDomain = extractDomainFromEmail(email);
  if (!emailDomain) return null;
  
  // First pass: exact domain match
  for (const account of accounts) {
    if (account.domain && normalizeDomain(emailDomain) === normalizeDomain(account.domain)) {
      return account.id;
    }
  }
  
  // Second pass: domain variations match
  for (const account of accounts) {
    if (matchEmailToAccount(email, account.domain, account.domainVariations)) {
      return account.id;
    }
  }
  
  return null;
}

/**
 * Extract subdomain from domain
 * Example: mail.google.com → mail
 */
export function extractSubdomain(domain: string | null): string | null {
  if (!domain) return null;
  const parts = domain.split('.');
  if (parts.length > 2) {
    return parts[0];
  }
  return null;
}

/**
 * Get root domain from subdomain
 * Example: mail.google.com → google.com
 */
export function getRootDomain(domain: string | null): string | null {
  if (!domain) return null;
  const parts = domain.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return domain;
}
