import mysql from 'mysql2/promise';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

// Load 6sense people data
const sixsenseData = fs.readFileSync('/home/ubuntu/upload/report_people_2025-12-14.csv', 'utf8');
const records = parse(sixsenseData, { columns: true, skip_empty_lines: true, relax_quotes: true });

console.log(`Loaded ${records.length} 6sense contact records`);

// Create lookup by email
const sixsenseByEmail = new Map();
for (const record of records) {
  const email = (record['Email'] || '').toLowerCase().trim();
  if (email) {
    sixsenseByEmail.set(email, record);
  }
}
console.log(`6sense contacts with email: ${sixsenseByEmail.size}`);

// Connect to database
const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Get all contacts
const [contacts] = await connection.execute('SELECT id, email, name FROM contacts WHERE email IS NOT NULL AND email != ""');
console.log(`\nContacts in DB with email: ${contacts.length}`);

let enriched = 0;
let notFound = 0;

for (const contact of contacts) {
  const email = (contact.email || '').toLowerCase().trim();
  const sixsense = sixsenseByEmail.get(email);
  
  if (sixsense) {
    // Parse numeric values
    const engagementScore = parseInt(sixsense['Engagement Score (Person)']) || null;
    const profileScore = parseInt(sixsense['Contact Profile Score']) || null;
    const engagementActivities = parseInt(sixsense['No.of Engagement Activities (Person)']) || null;
    const salesActivities = parseInt(sixsense['No.of Sales Activities (Person)']) || null;
    const daysSinceLastEngagement = parseInt(sixsense['Days Since Last Engagement Activity (Person) ']) || null;
    const daysSinceLastSalesActivity = parseInt(sixsense['Last Sales Activity (Days ago) (Person)']) || null;
    
    await connection.execute(`
      UPDATE contacts SET
        sixsenseMid = ?,
        engagementScore = ?,
        profileFit = ?,
        profileScore = ?,
        engagementGrade = ?,
        engagementTrend = ?,
        personaImportance = ?,
        engagementActivities = ?,
        salesActivities = ?,
        daysSinceLastEngagement = ?,
        daysSinceLastSalesActivity = ?,
        lastSalesActivity = ?,
        lastEngagementActivity = ?,
        city = ?,
        state = ?,
        country = ?,
        phone = COALESCE(phone, ?),
        title = COALESCE(title, ?)
      WHERE id = ?
    `, [
      sixsense['6sense Mid'] || null,
      engagementScore,
      sixsense['Contact Profile Fit'] || null,
      profileScore,
      sixsense['Engagement Grade'] || null,
      sixsense['Engagement Trend (Person)'] || null,
      sixsense['Persona Importance'] || null,
      engagementActivities,
      salesActivities,
      daysSinceLastEngagement,
      daysSinceLastSalesActivity,
      sixsense['Last Sales Activity (Person)'] || null,
      sixsense['Latest Engagement Activity (Person)'] || null,
      sixsense['Contact City'] || null,
      sixsense['Contact State'] || null,
      sixsense['Contact Country'] || null,
      sixsense['Contact Phone'] || null,
      sixsense['Title'] || null,
      contact.id
    ]);
    
    enriched++;
    if (enriched % 500 === 0) {
      console.log(`Enriched ${enriched} contacts...`);
    }
  } else {
    notFound++;
  }
}

console.log(`\n=== ENRICHMENT COMPLETE ===`);
console.log(`Contacts enriched with 6sense data: ${enriched}`);
console.log(`Contacts not found in 6sense: ${notFound}`);

// Show sample enriched contact
const [sample] = await connection.execute(`
  SELECT name, email, engagementScore, profileFit, profileScore, engagementGrade, personaImportance
  FROM contacts 
  WHERE engagementScore IS NOT NULL 
  ORDER BY engagementScore DESC 
  LIMIT 5
`);
console.log(`\nTop 5 engaged contacts:`);
for (const c of sample) {
  console.log(`  ${c.name} (${c.email}): Score ${c.engagementScore}, Fit: ${c.profileFit}, Grade: ${c.engagementGrade}`);
}

await connection.end();
