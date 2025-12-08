import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { accounts, contacts } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Generate email from name and domain
 */
function generateEmail(firstName: string | null, lastName: string | null, name: string | null, domain: string | null): string | null {
  if (!domain) return null;
  
  let emailPrefix = '';
  
  if (firstName && lastName) {
    // Use firstname.lastname@domain.com format
    emailPrefix = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
  } else if (name) {
    // Parse name and generate email
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      emailPrefix = `${parts[0].toLowerCase()}.${parts[parts.length - 1].toLowerCase()}`;
    } else {
      emailPrefix = name.toLowerCase().replace(/\s+/g, '.');
    }
  }
  
  if (!emailPrefix) return null;
  
  // Clean up email prefix
  emailPrefix = emailPrefix.replace(/[^a-z0-9.]/g, '');
  
  return `${emailPrefix}@${domain}`;
}

/**
 * Main script
 */
async function main() {
  console.log('\n=== Generating Contact Emails ===\n');
  
  // Create database connection
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection);
  
  // Get all contacts
  const allContacts = await db.select().from(contacts);
  console.log(`Found ${allContacts.length} contacts\n`);
  
  // Get all accounts with domains
  const allAccounts = await db.select().from(accounts);
  const accountMap = new Map(allAccounts.map(a => [a.id, a]));
  
  let emailsGenerated = 0;
  let skipped = 0;
  
  for (const contact of allContacts) {
    // Skip if already has email
    if (contact.email) {
      continue;
    }
    
    // Get account
    const account = accountMap.get(contact.accountId);
    if (!account || !account.domain) {
      skipped++;
      continue;
    }
    
    // Generate email
    const email = generateEmail(contact.firstName, contact.lastName, contact.name, account.domain);
    
    if (email) {
      await db
        .update(contacts)
        .set({ email })
        .where(eq(contacts.id, contact.id));
      
      emailsGenerated++;
      
      if (emailsGenerated <= 20) {
        console.log(`✓ Contact ${contact.id}: ${contact.name} → ${email}`);
      }
    } else {
      skipped++;
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Emails generated: ${emailsGenerated}`);
  console.log(`Skipped: ${skipped} (no domain or name data)`);
  
  await connection.end();
}

main().catch(console.error);
