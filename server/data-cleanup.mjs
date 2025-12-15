/**
 * Data Cleanup Script
 * - Deduplicate contacts by email
 * - Remove contacts without emails (low value)
 * - Fix domain variations for email matching
 * - Fill missing intent scores where possible
 * 
 * Run with: node server/data-cleanup.mjs
 */

import mysql from 'mysql2/promise';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  const [, user, password, host, port, database] = match;
  
  console.log('🧹 DATA CLEANUP STARTING...\n');
  
  const conn = await mysql.createConnection({
    host, port: parseInt(port), user, password, database,
    ssl: { rejectUnauthorized: false }
  });
  
  // 1. DEDUPLICATE CONTACTS BY EMAIL
  console.log('1️⃣ DEDUPLICATING CONTACTS BY EMAIL...');
  
  // Find duplicate emails and keep the one with most data
  const [dupes] = await conn.execute(`
    SELECT email, GROUP_CONCAT(id ORDER BY 
      CASE WHEN title IS NOT NULL AND title != '' THEN 0 ELSE 1 END,
      CASE WHEN phone IS NOT NULL AND phone != '' THEN 0 ELSE 1 END,
      CASE WHEN linkedinUrl IS NOT NULL AND linkedinUrl != '' THEN 0 ELSE 1 END,
      id ASC
    ) as ids
    FROM contacts
    WHERE email IS NOT NULL AND email != ''
    GROUP BY email
    HAVING COUNT(*) > 1
  `);
  
  let deletedDupes = 0;
  for (const dupe of dupes) {
    const ids = dupe.ids.split(',').map(Number);
    const keepId = ids[0]; // Keep the first (best) one
    const deleteIds = ids.slice(1);
    
    if (deleteIds.length > 0) {
      await conn.execute(`DELETE FROM contacts WHERE id IN (${deleteIds.join(',')})`);
      deletedDupes += deleteIds.length;
    }
  }
  console.log(`   Deleted ${deletedDupes} duplicate contacts`);
  
  // 2. ADD DOMAIN VARIATIONS TO ACCOUNTS
  console.log('\n2️⃣ ADDING DOMAIN VARIATIONS FOR BETTER MATCHING...');
  
  // Known domain variations/subsidiaries
  const domainVariations = {
    'caesars.com': ['eldoradoresorts.com', 'caesarspalace.com', 'harrahs.com', 'lasvegas.harrahs.com'],
    'us.jll.com': ['jll.com'],
    'jll.com': ['us.jll.com'],
    'ukg.com': ['kronos.com', 'ultimatesoftware.com'],
    'microsoft.com': ['linkedin.com', 'github.com', 'azure.com'],
    'google.com': ['youtube.com', 'alphabet.com'],
    'meta.com': ['facebook.com', 'instagram.com', 'whatsapp.com'],
    'amazon.com': ['aws.amazon.com', 'twitch.tv'],
  };
  
  let updatedVariations = 0;
  for (const [mainDomain, variations] of Object.entries(domainVariations)) {
    const [result] = await conn.execute(`
      UPDATE accounts 
      SET domainVariations = ?
      WHERE domain = ? OR domain LIKE ?
    `, [JSON.stringify(variations), mainDomain, `%${mainDomain}`]);
    updatedVariations += result.affectedRows;
  }
  console.log(`   Updated ${updatedVariations} accounts with domain variations`);
  
  // 3. REASSIGN MISMATCHED CONTACTS TO CORRECT ACCOUNTS
  console.log('\n3️⃣ REASSIGNING MISMATCHED CONTACTS...');
  
  // Get all contacts with email domain not matching account domain
  const [mismatched] = await conn.execute(`
    SELECT c.id, c.email, c.accountId, a.domain as currentDomain,
           SUBSTRING_INDEX(c.email, '@', -1) as emailDomain
    FROM contacts c
    JOIN accounts a ON c.accountId = a.id
    WHERE c.email IS NOT NULL AND c.email != ''
    AND a.domain IS NOT NULL AND a.domain != ''
    AND c.email NOT LIKE CONCAT('%@%', a.domain)
    AND c.email NOT LIKE CONCAT('%@%', REPLACE(a.domain, 'www.', ''))
  `);
  
  let reassigned = 0;
  let keptAsSubsidiary = 0;
  
  for (const contact of mismatched) {
    const emailDomain = contact.emailDomain;
    
    // Check if there's an account with matching domain
    const [matchingAccount] = await conn.execute(`
      SELECT id, name FROM accounts 
      WHERE domain = ? OR domain LIKE ? OR domain LIKE ?
      LIMIT 1
    `, [emailDomain, `%${emailDomain}`, `%.${emailDomain}`]);
    
    if (matchingAccount.length > 0) {
      // Reassign to correct account
      await conn.execute(`UPDATE contacts SET accountId = ? WHERE id = ?`, 
        [matchingAccount[0].id, contact.id]);
      reassigned++;
    } else {
      // Check if it's a known subsidiary
      const currentAccount = await conn.execute(`
        SELECT domainVariations FROM accounts WHERE id = ?
      `, [contact.accountId]);
      
      if (currentAccount[0]?.length > 0) {
        const variations = currentAccount[0][0].domainVariations;
        if (variations) {
          try {
            const varArray = JSON.parse(variations);
            if (varArray.some(v => emailDomain.includes(v) || v.includes(emailDomain))) {
              keptAsSubsidiary++;
              continue;
            }
          } catch (e) {}
        }
      }
    }
  }
  console.log(`   Reassigned ${reassigned} contacts to correct accounts`);
  console.log(`   Kept ${keptAsSubsidiary} contacts as valid subsidiaries`);
  
  // 4. FILL MISSING INTENT SCORES
  console.log('\n4️⃣ FILLING MISSING INTENT SCORES...');
  
  // Set default intent score based on buying stage if available
  const [filled] = await conn.execute(`
    UPDATE accounts 
    SET intentScore = CASE 
      WHEN sixsenseBuyingStage = 'Purchase' THEN 85
      WHEN sixsenseBuyingStage = 'Decision' THEN 70
      WHEN sixsenseBuyingStage = 'Consideration' THEN 55
      WHEN sixsenseBuyingStage = 'Awareness' THEN 40
      WHEN sixsenseBuyingStage = 'Target' THEN 25
      ELSE 30
    END
    WHERE (intentScore IS NULL OR intentScore = 0)
    AND sixsenseBuyingStage IS NOT NULL
  `);
  console.log(`   Filled ${filled.affectedRows} accounts with intent scores from buying stage`);
  
  // 5. CLEAN UP CONTACTS WITHOUT EMAILS (optional - keep them but flag)
  console.log('\n5️⃣ ANALYZING CONTACTS WITHOUT EMAILS...');
  const [noEmail] = await conn.execute(`
    SELECT COUNT(*) as cnt FROM contacts WHERE email IS NULL OR email = ''
  `);
  console.log(`   ${noEmail[0].cnt} contacts without email (keeping for now - may have phone/LinkedIn)`);
  
  // 6. FIX MISSING INDUSTRIES
  console.log('\n6️⃣ FIXING MISSING/UNKNOWN INDUSTRIES...');
  
  // Try to infer industry from company name patterns
  const industryPatterns = [
    { pattern: '%bank%', industry: 'Financial Services' },
    { pattern: '%insurance%', industry: 'Insurance' },
    { pattern: '%software%', industry: 'Software' },
    { pattern: '%tech%', industry: 'Technology' },
    { pattern: '%health%', industry: 'Healthcare' },
    { pattern: '%pharma%', industry: 'Pharmaceuticals' },
    { pattern: '%retail%', industry: 'Retail' },
    { pattern: '%manufacturing%', industry: 'Manufacturing' },
    { pattern: '%energy%', industry: 'Energy' },
    { pattern: '%telecom%', industry: 'Telecommunications' },
  ];
  
  let fixedIndustries = 0;
  for (const { pattern, industry } of industryPatterns) {
    const [result] = await conn.execute(`
      UPDATE accounts 
      SET industry = ?
      WHERE (industry IS NULL OR industry = '' OR industry = 'Unknown')
      AND LOWER(name) LIKE ?
    `, [industry, pattern]);
    fixedIndustries += result.affectedRows;
  }
  console.log(`   Fixed ${fixedIndustries} accounts with inferred industries`);
  
  // 7. FINAL STATS
  console.log('\n📊 FINAL DATA QUALITY CHECK...');
  
  const [finalStats] = await conn.execute(`
    SELECT 
      COUNT(*) as total_accounts,
      SUM(CASE WHEN intentScore > 0 THEN 1 ELSE 0 END) as with_intent,
      SUM(CASE WHEN industry IS NOT NULL AND industry != '' AND industry != 'Unknown' THEN 1 ELSE 0 END) as with_industry
    FROM accounts
  `);
  
  const [contactStats] = await conn.execute(`
    SELECT 
      COUNT(*) as total_contacts,
      SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) as with_email,
      SUM(CASE WHEN title IS NOT NULL AND title != '' THEN 1 ELSE 0 END) as with_title
    FROM contacts
  `);
  
  console.log(`\n   Accounts: ${finalStats[0].total_accounts}`);
  console.log(`   - With intent score: ${finalStats[0].with_intent}`);
  console.log(`   - With industry: ${finalStats[0].with_industry}`);
  console.log(`\n   Contacts: ${contactStats[0].total_contacts}`);
  console.log(`   - With email: ${contactStats[0].with_email}`);
  console.log(`   - With title: ${contactStats[0].with_title}`);
  
  await conn.end();
  
  console.log('\n✅ DATA CLEANUP COMPLETE!');
}

main().catch(console.error);
