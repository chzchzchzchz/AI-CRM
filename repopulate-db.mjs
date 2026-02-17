#!/usr/bin/env node

/**
 * DATABASE REPOPULATION SCRIPT
 * 
 * Fetches all data from Salesforce, 6sense, and Gong
 * Inserts into database
 */

import axios from 'axios';
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
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

console.log('✅ Connected to database\n');
console.log('🔄 Starting database repopulation...\n');

// ============================================================================
// SALESFORCE DATA FETCH
// ============================================================================

async function fetchSalesforceAccounts() {
  console.log('📊 Fetching Salesforce accounts...');
  try {
    if (!process.env.SALESFORCE_INSTANCE_URL || !process.env.SALESFORCE_ACCESS_TOKEN) {
      console.log('⚠️  Salesforce credentials not configured, skipping');
      return [];
    }

    const query = `SELECT Id, Name, Website, Industry, NumberOfEmployees, BillingCity, BillingState, BillingCountry, Description, AnnualRevenue FROM Account LIMIT 1000`;
    
    const response = await axios.post(
      `${process.env.SALESFORCE_INSTANCE_URL}/services/data/v57.0/query`,
      { q: query },
      {
        headers: {
          Authorization: `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.records || [];
  } catch (error) {
    console.error('❌ Error fetching Salesforce accounts:', error.message);
    return [];
  }
}

async function fetchSalesforceContacts() {
  console.log('👥 Fetching Salesforce contacts...');
  try {
    if (!process.env.SALESFORCE_INSTANCE_URL || !process.env.SALESFORCE_ACCESS_TOKEN) {
      console.log('⚠️  Salesforce credentials not configured, skipping');
      return [];
    }

    const query = `SELECT Id, FirstName, LastName, Email, Phone, Title, Department, Account.Id, Account.Name FROM Contact LIMIT 5000`;
    
    const response = await axios.post(
      `${process.env.SALESFORCE_INSTANCE_URL}/services/data/v57.0/query`,
      { q: query },
      {
        headers: {
          Authorization: `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.records || [];
  } catch (error) {
    console.error('❌ Error fetching Salesforce contacts:', error.message);
    return [];
  }
}

async function fetchSalesforceOpportunities() {
  console.log('💼 Fetching Salesforce opportunities...');
  try {
    if (!process.env.SALESFORCE_INSTANCE_URL || !process.env.SALESFORCE_ACCESS_TOKEN) {
      console.log('⚠️  Salesforce credentials not configured, skipping');
      return [];
    }

    const query = `SELECT Id, Name, StageName, Amount, CloseDate, Account.Id, Account.Name FROM Opportunity LIMIT 2000`;
    
    const response = await axios.post(
      `${process.env.SALESFORCE_INSTANCE_URL}/services/data/v57.0/query`,
      { q: query },
      {
        headers: {
          Authorization: `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.records || [];
  } catch (error) {
    console.error('❌ Error fetching Salesforce opportunities:', error.message);
    return [];
  }
}

// ============================================================================
// 6SENSE DATA FETCH
// ============================================================================

async function fetch6senseCompanies() {
  console.log('🎯 Fetching 6sense company data...');
  try {
    if (!process.env.SIXSENSE_API_KEY) {
      console.log('⚠️  6sense API key not configured, skipping');
      return [];
    }

    const response = await axios.get(
      `${process.env.SIXSENSE_API_URL || 'https://api.6sense.com'}/companies`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.SIXSENSE_API_KEY}`,
        },
      }
    );

    return response.data.companies || [];
  } catch (error) {
    console.error('❌ Error fetching 6sense companies:', error.message);
    return [];
  }
}

// ============================================================================
// DATABASE INSERT
// ============================================================================

async function insertAccounts(accounts) {
  if (accounts.length === 0) return;
  
  console.log(`\n📝 Inserting ${accounts.length} accounts into database...`);
  
  let inserted = 0;
  for (const account of accounts) {
    try {
      let domain = null;
      if (account.Website) {
        try {
          domain = new URLClass(account.Website).hostname;
        } catch (e) {
          domain = account.Website;
        }
      }
      
      await db.execute(
        `INSERT INTO accounts (name, domain, industry, employeeCount, city, state, country, description, annualRevenue, sfdcAccountId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE updatedAt = NOW()`,
        [
          account.Name,
          domain,
          account.Industry,
          account.NumberOfEmployees,
          account.BillingCity,
          account.BillingState,
          account.BillingCountry,
          account.Description,
          account.AnnualRevenue,
          account.Id,
        ]
      );
      inserted++;
    } catch (error) {
      console.error(`Error inserting account ${account.Name}:`, error.message);
    }
  }
  
  console.log(`✅ Inserted ${inserted}/${accounts.length} accounts`);
}

async function insertContacts(contacts) {
  if (contacts.length === 0) return;
  
  console.log(`\n👥 Inserting ${contacts.length} contacts into database...`);
  
  let inserted = 0;
  for (const contact of contacts) {
    try {
      // Find account ID in database
      const [accounts] = await db.execute(
        'SELECT id FROM accounts WHERE sfdcAccountId = ? LIMIT 1',
        [contact.Account?.Id]
      );
      
      const accountId = accounts[0]?.id;
      
      await db.execute(
        `INSERT INTO contacts (accountId, firstName, lastName, email, phone, title, department, sfdcContactId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE updatedAt = NOW()`,
        [
          accountId,
          contact.FirstName,
          contact.LastName,
          contact.Email,
          contact.Phone,
          contact.Title,
          contact.Department,
          contact.Id,
        ]
      );
      inserted++;
    } catch (error) {
      console.error(`Error inserting contact ${contact.FirstName} ${contact.LastName}:`, error.message);
    }
  }
  
  console.log(`✅ Inserted ${inserted}/${contacts.length} contacts`);
}

async function insertOpportunities(opportunities) {
  if (opportunities.length === 0) return;
  
  console.log(`\n💼 Inserting ${opportunities.length} opportunities into database...`);
  
  let inserted = 0;
  for (const opp of opportunities) {
    try {
      // Find account ID in database
      const [accounts] = await db.execute(
        'SELECT id FROM accounts WHERE sfdcAccountId = ? LIMIT 1',
        [opp.Account?.Id]
      );
      
      const accountId = accounts[0]?.id;
      
      await db.execute(
        `INSERT INTO opportunities (accountId, name, stage, amount, closeDate, sfdcOpportunityId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE updatedAt = NOW()`,
        [
          accountId,
          opp.Name,
          opp.StageName,
          opp.Amount,
          opp.CloseDate,
          opp.Id,
        ]
      );
      inserted++;
    } catch (error) {
      console.error(`Error inserting opportunity ${opp.Name}:`, error.message);
    }
  }
  
  console.log(`✅ Inserted ${inserted}/${opportunities.length} opportunities`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    // Fetch all data
    const [sfdcAccounts, sfdcContacts, sfdcOpportunities, sixsenseCompanies] = await Promise.all([
      fetchSalesforceAccounts(),
      fetchSalesforceContacts(),
      fetchSalesforceOpportunities(),
      fetch6senseCompanies(),
    ]);

    console.log(`\n📊 Data Summary:`);
    console.log(`  - Salesforce Accounts: ${sfdcAccounts.length}`);
    console.log(`  - Salesforce Contacts: ${sfdcContacts.length}`);
    console.log(`  - Salesforce Opportunities: ${sfdcOpportunities.length}`);
    console.log(`  - 6sense Companies: ${sixsenseCompanies.length}`);

    // Insert into database
    await insertAccounts(sfdcAccounts);
    await insertContacts(sfdcContacts);
    await insertOpportunities(sfdcOpportunities);

    // Verify
    const [accountCount] = await db.execute('SELECT COUNT(*) as count FROM accounts');
    const [contactCount] = await db.execute('SELECT COUNT(*) as count FROM contacts');
    const [opportunityCount] = await db.execute('SELECT COUNT(*) as count FROM opportunities');

    console.log(`\n✅ Database Repopulation Complete!`);
    console.log(`  - Total Accounts: ${accountCount[0].count}`);
    console.log(`  - Total Contacts: ${contactCount[0].count}`);
    console.log(`  - Total Opportunities: ${opportunityCount[0].count}`);

    await db.end();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
