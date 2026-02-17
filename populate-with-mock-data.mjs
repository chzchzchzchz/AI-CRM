#!/usr/bin/env node

/**
 * POPULATE DATABASE WITH MOCK DATA
 * 
 * Creates realistic mock accounts, contacts, and calls
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { URL as URLClass } from 'url';

dotenv.config();

// Parse DATABASE_URL
const dbUrl = new URLClass(process.env.DATABASE_URL);
const [user, password] = dbUrl.username ? [dbUrl.username, dbUrl.password] : ['root', ''];
const host = dbUrl.hostname;
const port = dbUrl.port || 3306;
const database = dbUrl.pathname.split('/')[1];

console.log(`🔗 Connecting to database: ${host}:${port}/${database}`);

const db = await mysql.createConnection({
  host,
  port: parseInt(port),
  user,
  password,
  database,
  ssl: {},
});

console.log('✅ Connected to database\n');

// Mock data
const mockAccounts = [
  { name: 'Microsoft', domain: 'microsoft.com', industry: 'Software', employeeCount: 221000, intentScore: 72 },
  { name: 'Google', domain: 'google.com', industry: 'Technology', employeeCount: 190234, intentScore: 85 },
  { name: 'Amazon', domain: 'amazon.com', industry: 'E-commerce', employeeCount: 1608000, intentScore: 78 },
  { name: 'Apple', domain: 'apple.com', industry: 'Technology', employeeCount: 164000, intentScore: 65 },
  { name: 'Meta', domain: 'meta.com', industry: 'Social Media', employeeCount: 67317, intentScore: 88 },
  { name: 'Tesla', domain: 'tesla.com', industry: 'Automotive', employeeCount: 127855, intentScore: 92 },
  { name: 'Netflix', domain: 'netflix.com', industry: 'Entertainment', employeeCount: 12800, intentScore: 75 },
  { name: 'Uber', domain: 'uber.com', industry: 'Transportation', employeeCount: 28297, intentScore: 81 },
  { name: 'Airbnb', domain: 'airbnb.com', industry: 'Hospitality', employeeCount: 8000, intentScore: 70 },
  { name: 'Stripe', domain: 'stripe.com', industry: 'Fintech', employeeCount: 7000, intentScore: 95 },
  { name: 'Salesforce', domain: 'salesforce.com', industry: 'CRM', employeeCount: 80000, intentScore: 82 },
  { name: 'Oracle', domain: 'oracle.com', industry: 'Database', employeeCount: 135000, intentScore: 68 },
  { name: 'IBM', domain: 'ibm.com', industry: 'Technology', employeeCount: 282100, intentScore: 60 },
  { name: 'Intel', domain: 'intel.com', industry: 'Semiconductors', employeeCount: 110600, intentScore: 73 },
  { name: 'Cisco', domain: 'cisco.com', industry: 'Networking', employeeCount: 77500, intentScore: 79 },
];

const mockContactFirstNames = ['John', 'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'Robert', 'Lisa', 'James', 'Jennifer', 'William', 'Mary', 'Richard', 'Patricia', 'Joseph'];
const mockContactLastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];
const mockTitles = ['VP of Sales', 'Director of Engineering', 'Chief Technology Officer', 'VP of Marketing', 'Head of Product', 'VP of Operations', 'Chief Financial Officer', 'VP of HR', 'Director of Sales', 'Product Manager', 'Engineering Manager', 'Sales Manager', 'Marketing Manager'];

async function insertAccounts() {
  console.log(`📝 Inserting ${mockAccounts.length} mock accounts...`);
  
  for (const account of mockAccounts) {
    try {
      await db.execute(
        `INSERT INTO accounts (name, domain, industry, employeeCount, intentScore, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE updatedAt = NOW()`,
        [account.name, account.domain, account.industry, account.employeeCount, account.intentScore]
      );
    } catch (error) {
      console.error(`Error inserting account ${account.name}:`, error.message);
    }
  }
  
  console.log(`✅ Inserted ${mockAccounts.length} accounts`);
}

async function insertContacts() {
  console.log(`\n👥 Inserting mock contacts...`);
  
  // Get all accounts
  const [accounts] = await db.execute('SELECT id, name FROM accounts');
  
  let inserted = 0;
  for (const account of accounts) {
    // Create 3-5 contacts per account
    const contactCount = Math.floor(Math.random() * 3) + 3;
    
    for (let i = 0; i < contactCount; i++) {
      try {
        const firstName = mockContactFirstNames[Math.floor(Math.random() * mockContactFirstNames.length)];
        const lastName = mockContactLastNames[Math.floor(Math.random() * mockContactLastNames.length)];
        const title = mockTitles[Math.floor(Math.random() * mockTitles.length)];
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${account.name.toLowerCase().replace(/\s+/g, '')}.com`;
        const phone = `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
        
        await db.execute(
          `INSERT INTO contacts (accountId, firstName, lastName, email, phone, title, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE updatedAt = NOW()`,
          [account.id, firstName, lastName, email, phone, title]
        );
        inserted++;
      } catch (error) {
        console.error(`Error inserting contact:`, error.message);
      }
    }
  }
  
  console.log(`✅ Inserted ${inserted} contacts`);
}

async function insertCalls() {
  console.log(`\n📞 Inserting mock calls...`);
  
  // Get all contacts
  const [contacts] = await db.execute('SELECT id, accountId FROM contacts');
  
  let inserted = 0;
  for (const contact of contacts) {
    // Create 0-3 calls per contact
    const callCount = Math.floor(Math.random() * 3);
    
    for (let i = 0; i < callCount; i++) {
      try {
        const duration = Math.floor(Math.random() * 3600) + 300; // 5 min to 1 hour
        const sentiment = ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)];
        const date = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000); // Last 90 days
        
        await db.execute(
          `INSERT INTO calls (accountId, contactId, title, duration, sentiment, recordedAt, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [contact.accountId, contact.id, `Call with ${contact.id}`, duration, sentiment, date]
        );
        inserted++;
      } catch (error) {
        console.error(`Error inserting call:`, error.message);
      }
    }
  }
  
  console.log(`✅ Inserted ${inserted} calls`);
}

async function main() {
  try {
    await insertAccounts();
    await insertContacts();
    await insertCalls();

    // Verify
    const [accountCount] = await db.execute('SELECT COUNT(*) as count FROM accounts');
    const [contactCount] = await db.execute('SELECT COUNT(*) as count FROM contacts');
    const [callCount] = await db.execute('SELECT COUNT(*) as count FROM calls');

    console.log(`\n✅ Database Population Complete!`);
    console.log(`  - Total Accounts: ${accountCount[0].count}`);
    console.log(`  - Total Contacts: ${contactCount[0].count}`);
    console.log(`  - Total Calls: ${callCount[0].count}`);

    await db.end();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
