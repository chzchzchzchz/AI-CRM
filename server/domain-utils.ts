/**
 * Domain normalization utilities for consistent account matching
 * across Salesforce, LinkedIn, and internal database
 */

/**
 * Normalize a domain to a consistent format for matching
 * Handles: www prefix, subdomains, trailing slashes, protocols
 */
export function normalizeDomain(domain: string | undefined | null): string | null {
  if (!domain) return null;
  
  try {
    // Remove protocol if present
    let normalized = domain.replace(/^(https?:\/\/)/, '');
    
    // Remove trailing slashes
    normalized = normalized.replace(/\/$/, '');
    
    // Try to parse as URL to extract hostname
    try {
      const url = new URL(`https://${normalized}`);
      normalized = url.hostname;
    } catch {
      // If URL parsing fails, just clean it up manually
      normalized = normalized.split('/')[0];
    }
    
    // Remove www. prefix
    normalized = normalized.replace(/^www\./, '');
    
    // Convert to lowercase
    normalized = normalized.toLowerCase().trim();
    
    // Validate it looks like a domain
    if (!normalized.includes('.') || normalized.length < 3) {
      return null;
    }
    
    return normalized;
  } catch {
    return null;
  }
}

/**
 * Extract domain from email address
 */
export function extractDomainFromEmail(email: string | undefined | null): string | null {
  if (!email) return null;
  
  try {
    const parts = email.split('@');
    if (parts.length !== 2) return null;
    
    const domain = parts[1];
    return normalizeDomain(domain);
  } catch {
    return null;
  }
}

/**
 * Get all domain variations for an account
 * Includes: primary domain, subdomains, alternate TLDs
 */
export function generateDomainVariations(domain: string | undefined | null): string[] {
  const normalized = normalizeDomain(domain);
  if (!normalized) return [];
  
  const variations = new Set<string>();
  variations.add(normalized);
  
  // Add www version
  variations.add(`www.${normalized}`);
  
  // If it's a subdomain, also add parent domain
  const parts = normalized.split('.');
  if (parts.length > 2) {
    // It's a subdomain like api.example.com
    const parentDomain = parts.slice(-2).join('.');
    variations.add(parentDomain);
    variations.add(`www.${parentDomain}`);
  }
  
  return Array.from(variations);
}

/**
 * Compare two domains for equivalence
 * Returns true if they normalize to the same domain
 */
export function domainsMatch(domain1: string | undefined | null, domain2: string | undefined | null): boolean {
  const norm1 = normalizeDomain(domain1);
  const norm2 = normalizeDomain(domain2);
  
  if (!norm1 || !norm2) return false;
  
  // Exact match
  if (norm1 === norm2) return true;
  
  // Check if one is a subdomain of the other
  if (norm1.endsWith(`.${norm2}`) || norm2.endsWith(`.${norm1}`)) {
    return true;
  }
  
  return false;
}

/**
 * Extract company name from domain
 * e.g., "example.com" -> "Example"
 */
export function companyNameFromDomain(domain: string | undefined | null): string | null {
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;
  
  // Get the part before the first dot
  const company = normalized.split('.')[0];
  
  // Capitalize first letter
  return company.charAt(0).toUpperCase() + company.slice(1).toLowerCase();
}
