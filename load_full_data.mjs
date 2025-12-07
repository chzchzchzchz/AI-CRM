import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

console.log('================================================================================');
console.log('LOADING FULL DATASET INTO DATABASE');
console.log('================================================================================\n');

// Load parsed JSON data
const accounts = JSON.parse(readFileSync('./scripts/full_accounts.json', 'utf-8'));
const people = JSON.parse(readFileSync('./scripts/full_people.json', 'utf-8'));
const calls = JSON.parse(readFileSync('./scripts/full_calls.json', 'utf-8'));

console.log(`Loaded from JSON:`);
console.log(`  - ${accounts.length} accounts`);
console.log(`  - ${people.length} contacts`);
console.log(`  - ${calls.length} Gong calls\n`);

// Connect to database
const connection = await mysql.createConnection(DATABASE_URL);

console.log('[1/4] Clearing existing data...');
await connection.execute('DELETE FROM gongCalls');
await connection.execute('DELETE FROM people');
await connection.execute('DELETE FROM accounts');
console.log('   ✓ Cleared all tables\n');

console.log('[2/4] Importing accounts...');
let accountCount = 0;
for (const acc of accounts) {
  // Flatten all the nested data into JSON strings
  const stackData = {
    ...(acc.tech_stack || {}),
    ...(acc.sixsense || {}),
  };
  
  const researchData = {
    ...(acc.security || {}),
    ...(acc.intelligence || {}),
    ...(acc.insights || {}),
  };
  
  const triggerData = {
    ...(acc.funding || {}),
    ...(acc.news || {}),
  };
  
  const rawData = {
    ...(acc.enrichment || {}),
    ...(acc.contacts || {}),
    ...(acc.metadata || {}),
    ...(acc.sfdc || {}),
    source: 'comprehensive_import',
  };
  
  // Get best values from merged data
  const name = acc.name || acc.sfdc?.account_name || 'Unknown';
  const region = acc.sfdc?.region || acc.country || null;
  const industry = acc.sfdc?.industry || null;
  const employees = acc.enrichment?.employee_count_value || acc.sfdc?.employee_count || null;
  const description = acc.sfdc?.description || null;
  const url = acc.sfdc?.url || `https://${acc.domain}`;
  const intentScore = acc.sfdc?.intent_score || null;
  const fitScore = acc.sfdc?.profile_fit || null;
  
  await connection.execute(
    `INSERT INTO accounts (clayId, name, domain, region, industry, employees, description, url, intentScore, fitScore, stack, research, \`trigger\`, rawData)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       region = VALUES(region),
       industry = VALUES(industry),
       employees = VALUES(employees),
       description = VALUES(description),
       url = VALUES(url),
       intentScore = VALUES(intentScore),
       fitScore = VALUES(fitScore),
       stack = VALUES(stack),
       research = VALUES(research),
       \`trigger\` = VALUES(\`trigger\`),
       rawData = VALUES(rawData)`,
    [
      `full-${acc.domain}`,
      name,
      acc.domain,
      region,
      industry,
      employees,
      description,
      url,
      intentScore,
      fitScore,
      JSON.stringify(stackData),
      JSON.stringify(researchData),
      JSON.stringify(triggerData),
      JSON.stringify(rawData),
    ]
  );
  accountCount++;
  if (accountCount % 100 === 0) {
    console.log(`   ... ${accountCount} accounts imported`);
  }
}
console.log(`   ✓ Imported ${accountCount} accounts\n`);

console.log('[3/4] Importing contacts...');
let peopleCount = 0;
for (const person of people) {
  const personRawData = {
    domain: person.domain,
    region: person.region,
    seniority: person.seniority,
    department: person.department,
    employee_count: person.employee_count,
    industry: person.industry,
    keywords: person.keywords,
    phone: person.phone,
  };
  
  await connection.execute(
    `INSERT INTO people (clayId, name, title, email, linkedin, location, company, rawData)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       email = VALUES(email),
       linkedin = VALUES(linkedin),
       location = VALUES(location),
       rawData = VALUES(rawData)`,
    [
      `full-${person.name.toLowerCase()}-${person.company.toLowerCase()}`,
      person.name,
      person.title,
      person.email,
      person.linkedin,
      person.location,
      person.company,
      JSON.stringify(personRawData),
    ]
  );
  peopleCount++;
  if (peopleCount % 200 === 0) {
    console.log(`   ... ${peopleCount} contacts imported`);
  }
}
console.log(`   ✓ Imported ${peopleCount} contacts\n`);

console.log('[4/4] Importing Gong calls and linking to accounts/contacts...');
let callsCount = 0;
for (const call of calls) {
  // Find matching account by domain
  let accountId = null;
  if (call.company_domain) {
    const [rows] = await connection.execute(
      'SELECT id FROM accounts WHERE domain = ? LIMIT 1',
      [call.company_domain]
    );
    if (rows.length > 0) {
      accountId = rows[0].id;
    }
  }
  
  // Try to find matching person by parsing speakers
  let personId = null;
  if (call.speakers && call.company) {
    // Speakers format might be "John Doe, Jane Smith"
    const speakerNames = call.speakers.split(',').map(s => s.trim());
    for (const speakerName of speakerNames) {
      const [rows] = await connection.execute(
        'SELECT id FROM people WHERE name LIKE ? AND company = ? LIMIT 1',
        [`%${speakerName}%`, call.company]
      );
      if (rows.length > 0) {
        personId = rows[0].id;
        break;
      }
    }
  }
  
  await connection.execute(
    `INSERT INTO gongCalls (callId, accountId, personId, callDate, duration, title, link, transcript, summary, speakers, company, companyDomain)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       accountId = VALUES(accountId),
       personId = VALUES(personId),
       callDate = VALUES(callDate),
       duration = VALUES(duration),
       title = VALUES(title),
       link = VALUES(link),
       transcript = VALUES(transcript),
       summary = VALUES(summary),
       speakers = VALUES(speakers),
       company = VALUES(company),
       companyDomain = VALUES(companyDomain)`,
    [
      call.call_id,
      accountId,
      personId,
      call.call_date,
      call.duration,
      call.title,
      call.link,
      call.transcript,
      call.summary,
      call.speakers,
      call.company,
      call.company_domain,
    ]
  );
  callsCount++;
  if (callsCount % 50 === 0) {
    console.log(`   ... ${callsCount} calls imported`);
  }
}
console.log(`   ✓ Imported ${callsCount} Gong calls\n`);

await connection.end();

console.log('================================================================================');
console.log('DATABASE IMPORT COMPLETE!');
console.log('================================================================================');
console.log(`\nFinal counts:`);
console.log(`  - ${accountCount} accounts`);
console.log(`  - ${peopleCount} contacts`);
console.log(`  - ${callsCount} Gong calls`);
console.log('\n✓ All data imported successfully with cross-references');
