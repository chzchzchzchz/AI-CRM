import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { accounts, contacts } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

/**
 * Parse CSV file
 */
function parseCSV(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split('","').map(h => h.replace(/^"|"$/g, ''));
  
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = lines[i].split('","').map(v => v.replace(/^"|"$/g, ''));
    const row: any = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || null;
    });
    
    rows.push(row);
  }
  
  return rows;
}

/**
 * Extract domain from email
 */
function extractDomain(email: string | null): string | null {
  if (!email) return null;
  const parts = email.toLowerCase().trim().split('@');
  if (parts.length !== 2) return null;
  return parts[1];
}

/**
 * Normalize domain
 */
function normalizeDomain(domain: string | null): string | null {
  if (!domain) return null;
  return domain.toLowerCase().trim().replace(/^www\./, '');
}

/**
 * Main import script
 */
async function main() {
  console.log('\n=== Importing Real Contacts from CSV ===\n');
  
  // Create database connection
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection);
  
  // Parse contacts CSV
  const csvPath = '/home/ubuntu/upload/Find-people-Table-Default-view-export-1765207530663.csv';
  console.log(`Reading ${csvPath}...\n`);
  
  const contactRows = parseCSV(csvPath);
  console.log(`Found ${contactRows.length} contact rows in CSV\n`);
  
  // Get all accounts with domain variations
  const allAccounts = await db.select().from(accounts);
  console.log(`Found ${allAccounts.length} accounts in database\n`);
  
  // Create domain to account mapping
  const domainToAccount = new Map<string, number>();
  
  for (const account of allAccounts) {
    // Add primary domain
    if (account.domain) {
      const normalized = normalizeDomain(account.domain);
      if (normalized) {
        domainToAccount.set(normalized, account.id);
      }
    }
    
    // Add domain variations
    if (account.domainVariations && Array.isArray(account.domainVariations)) {
      for (const variation of account.domainVariations as string[]) {
        const normalized = normalizeDomain(variation);
        if (normalized) {
          domainToAccount.set(normalized, account.id);
        }
      }
    }
  }
  
  console.log(`Created domain mapping for ${domainToAccount.size} domains\n`);
  
  // Import contacts
  let imported = 0;
  let skipped = 0;
  let matched = 0;
  let unmatched = 0;
  
  for (const row of contactRows) {
    // Extract contact data
    const firstName = row['First Name'];
    const lastName = row['Last Name'];
    const fullName = row['Full Name'] || `${firstName} ${lastName}`.trim();
    const title = row['Job Title'];
    const email = row['Work Email'];
    const linkedinUrl = row['LinkedIn Profile'];
    const location = row['Employee Location'];
    const companyName = row['Account Name'];
    const domain = row['Domain Name'];
    
    // Skip if no email
    if (!email || !email.includes('@')) {
      skipped++;
      continue;
    }
    
    // Find matching account by email domain
    const emailDomain = extractDomain(email);
    let accountId: number | null = null;
    
    if (emailDomain) {
      const normalized = normalizeDomain(emailDomain);
      if (normalized && domainToAccount.has(normalized)) {
        accountId = domainToAccount.get(normalized)!;
        matched++;
      } else {
        // Try to find by company domain from CSV
        if (domain) {
          const normalizedDomain = normalizeDomain(domain);
          if (normalizedDomain && domainToAccount.has(normalizedDomain)) {
            accountId = domainToAccount.get(normalizedDomain)!;
            matched++;
          }
        }
      }
    }
    
    if (!accountId) {
      unmatched++;
      if (unmatched <= 10) {
        console.log(`⚠️  No account match for: ${email} (${companyName})`);
      }
      continue;
    }
    
    // Insert contact
    await db.insert(contacts).values({
      accountId,
      firstName: firstName || null,
      lastName: lastName || null,
      name: fullName,
      title: title || null,
      email: email,
      linkedinUrl: linkedinUrl || null,
      location: location || null,
    });
    
    imported++;
    
    if (imported <= 20) {
      const account = allAccounts.find(a => a.id === accountId);
      console.log(`✓ Imported: ${fullName} (${email}) → ${account?.name}`);
    }
  }
  
  console.log(`\n=== Import Summary ===`);
  console.log(`Total rows in CSV: ${contactRows.length}`);
  console.log(`Contacts imported: ${imported}`);
  console.log(`Contacts matched to accounts: ${matched}`);
  console.log(`Contacts skipped (no email): ${skipped}`);
  console.log(`Contacts unmatched (no account found): ${unmatched}`);
  
  await connection.end();
}

main().catch(console.error);
