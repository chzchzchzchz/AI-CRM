#!/usr/bin/env node
/**
 * Import parsed accounts and contacts into the database
 */

import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Parse connection string
const url = new URL(DATABASE_URL);
const config = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: true }
};

async function main() {
  const connection = await mysql.createConnection(config);
  
  // Read parsed data
  const accounts = JSON.parse(readFileSync('./scripts/accounts-import.json', 'utf-8'));
  const contacts = JSON.parse(readFileSync('./scripts/contacts-import.json', 'utf-8'));
  
  console.log(`Importing ${accounts.length} accounts and ${contacts.length} contacts...`);
  
  // Import accounts
  let accountsImported = 0;
  let accountsUpdated = 0;
  
  for (const account of accounts) {
    try {
      // Check if account exists by domain or name
      const [existing] = await connection.execute(
        'SELECT id FROM accounts WHERE domain = ? OR name = ? LIMIT 1',
        [account.domain || '', account.name]
      );
      
      const rawData = JSON.stringify({
        ssoVendors: account.ssoVendors,
        mfaVendors: account.mfaVendors,
        description: account.description,
        contactRecords: account.contactRecords,
        gongCallHistory: account.gongCallHistory,
      });
      
      if (existing.length > 0) {
        // Update existing account
        await connection.execute(
          `UPDATE accounts SET 
            industry = COALESCE(NULLIF(?, ''), industry),
            employeeCount = COALESCE(NULLIF(?, ''), employeeCount),
            sixsenseBuyingStage = COALESCE(NULLIF(?, ''), sixsenseBuyingStage),
            region = COALESCE(NULLIF(?, ''), region),
            rawData = ?
          WHERE id = ?`,
          [
            account.industry || '',
            account.employeeRange || '',
            account.buyingStage || '',
            account.country || '',
            rawData,
            existing[0].id
          ]
        );
        accountsUpdated++;
      } else {
        // Insert new account
        await connection.execute(
          `INSERT INTO accounts (name, domain, industry, employeeCount, sixsenseBuyingStage, region, rawData)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            account.name,
            account.domain || '',
            account.industry || '',
            account.employeeRange || '',
            account.buyingStage || '',
            account.country || '',
            rawData
          ]
        );
        accountsImported++;
      }
    } catch (err) {
      console.error(`Error importing account ${account.name}:`, err.message);
    }
  }
  
  console.log(`Accounts: ${accountsImported} imported, ${accountsUpdated} updated`);
  
  // Build account lookup by name and domain
  const [accountRows] = await connection.execute('SELECT id, name, domain FROM accounts');
  const accountByName = new Map();
  const accountByDomain = new Map();
  for (const row of accountRows) {
    accountByName.set(row.name.toLowerCase(), row.id);
    if (row.domain) accountByDomain.set(row.domain.toLowerCase(), row.id);
  }
  
  // Import contacts
  let contactsImported = 0;
  let contactsSkipped = 0;
  
  for (const contact of contacts) {
    try {
      // Find account ID
      let accountId = null;
      if (contact.accountName) {
        accountId = accountByName.get(contact.accountName.toLowerCase());
      }
      if (!accountId && contact.domain) {
        accountId = accountByDomain.get(contact.domain.toLowerCase());
      }
      
      if (!accountId) {
        contactsSkipped++;
        continue;
      }
      
      // Check if contact exists
      const [existing] = await connection.execute(
        'SELECT id FROM contacts WHERE name = ? AND accountId = ? LIMIT 1',
        [contact.fullName, accountId]
      );
      
      if (existing.length === 0) {
        await connection.execute(
          `INSERT INTO contacts (name, title, accountId)
           VALUES (?, ?, ?)`,
          [
            contact.fullName,
            contact.title || '',
            accountId
          ]
        );
        contactsImported++;
      }
    } catch (err) {
      console.error(`Error importing contact ${contact.fullName}:`, err.message);
    }
  }
  
  console.log(`Contacts: ${contactsImported} imported, ${contactsSkipped} skipped (no matching account)`);
  
  await connection.end();
  console.log('Import complete!');
}

main().catch(console.error);
