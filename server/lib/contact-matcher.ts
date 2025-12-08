/**
 * Contact-Account Smart Matching Service
 * Provides utilities for matching contacts to accounts using domain variations
 */

import { eq } from 'drizzle-orm';
import { accounts, contacts } from '../../drizzle/schema';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { extractDomainFromEmail, normalizeDomain } from './domainMatcher';

/**
 * Find best matching account for a contact email
 */
export async function findAccountByContactEmail(
  db: MySql2Database,
  email: string | null
): Promise<number | null> {
  if (!email) return null;
  
  const emailDomain = extractDomainFromEmail(email);
  if (!emailDomain) return null;
  
  // Get all accounts
  const allAccounts = await db.select().from(accounts);
  
  // First pass: exact domain match
  for (const account of allAccounts) {
    if (account.domain && normalizeDomain(emailDomain) === normalizeDomain(account.domain)) {
      return account.id;
    }
  }
  
  // Second pass: domain variations match
  for (const account of allAccounts) {
    if (account.domainVariations && Array.isArray(account.domainVariations)) {
      const normalizedEmail = normalizeDomain(emailDomain);
      const found = (account.domainVariations as string[]).some(
        variation => normalizeDomain(variation) === normalizedEmail
      );
      if (found) {
        return account.id;
      }
    }
  }
  
  return null;
}

/**
 * Verify contact-account relationship using domain matching
 */
export async function verifyContactAccountMatch(
  db: MySql2Database,
  contactId: number
): Promise<{
  isValid: boolean;
  currentAccountId: number;
  suggestedAccountId: number | null;
  reason: string;
}> {
  const contact = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  
  if (!contact || contact.length === 0) {
    return {
      isValid: false,
      currentAccountId: 0,
      suggestedAccountId: null,
      reason: 'Contact not found'
    };
  }
  
  const contactData = contact[0];
  const suggestedAccountId = await findAccountByContactEmail(db, contactData.email);
  
  if (!suggestedAccountId) {
    return {
      isValid: false,
      currentAccountId: contactData.accountId,
      suggestedAccountId: null,
      reason: 'No matching account found for email domain'
    };
  }
  
  if (suggestedAccountId === contactData.accountId) {
    return {
      isValid: true,
      currentAccountId: contactData.accountId,
      suggestedAccountId,
      reason: 'Contact correctly linked to account'
    };
  }
  
  return {
    isValid: false,
    currentAccountId: contactData.accountId,
    suggestedAccountId,
    reason: 'Contact linked to wrong account - domain mismatch'
  };
}

/**
 * Get all contacts for an account (using domain matching)
 */
export async function getAccountContacts(
  db: MySql2Database,
  accountId: number
): Promise<Array<typeof contacts.$inferSelect>> {
  // Get account
  const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  
  if (!account || account.length === 0) {
    return [];
  }
  
  const accountData = account[0];
  
  // Get all contacts
  const allContacts = await db.select().from(contacts);
  
  // Filter contacts that match this account's domain
  const matchingContacts = allContacts.filter(contact => {
    if (contact.accountId === accountId) return true;
    
    if (!contact.email) return false;
    
    const emailDomain = extractDomainFromEmail(contact.email);
    if (!emailDomain) return false;
    
    // Check primary domain
    if (accountData.domain && normalizeDomain(emailDomain) === normalizeDomain(accountData.domain)) {
      return true;
    }
    
    // Check domain variations
    if (accountData.domainVariations && Array.isArray(accountData.domainVariations)) {
      const normalizedEmail = normalizeDomain(emailDomain);
      return (accountData.domainVariations as string[]).some(
        variation => normalizeDomain(variation) === normalizedEmail
      );
    }
    
    return false;
  });
  
  return matchingContacts;
}
