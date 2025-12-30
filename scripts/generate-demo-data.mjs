import mysql from 'mysql2/promise';
import { faker } from '@faker-js/faker';

// Fictional company names and details
const FICTIONAL_COMPANIES = [
  'TechVault Systems', 'CloudWave Solutions', 'SecureNet Inc', 'DataShield Corp',
  'CyberGuard Technologies', 'IdentityFlow Pro', 'ZeroTrust Dynamics', 'VaultCore Systems',
  'AuthentiGuard Inc', 'EncryptionWorks', 'SecurityFirst Labs', 'IdentityPro Solutions',
  'CloudSafe Systems', 'VerifyTech Corp', 'AccessControl Inc', 'ProtectData Systems',
  'SecureIdentity Labs', 'TrustVault Inc', 'AuthenticationHub', 'CyberDefense Pro',
  'IdentityManagement Corp', 'SecureAccess Systems', 'CloudGuard Inc', 'DataProtect Labs',
  'VerificationWorks', 'SecurityHub Pro', 'AccessGuard Systems', 'EncryptionPro Inc',
  'TrustTech Solutions', 'IdentitySecure Corp', 'CloudProtect Systems', 'SafeAuth Inc',
  'VerifySecure Labs', 'AuthenticationPro', 'CyberSecure Corp', 'IdentityVault Systems',
  'SecureCloud Inc', 'DataGuard Pro', 'TrustAuthentication', 'ProtectAccess Systems',
  'SecurityVerify Corp', 'CloudIdentity Inc', 'SafeGuard Systems', 'AuthenticationSecure',
  'EncryptionSecure', 'IdentityTrust Corp', 'SecureVerify Inc', 'AccessSecure Systems'
];

const INDUSTRIES = [
  'Software', 'Finance', 'Healthcare', 'Manufacturing', 'Retail', 'Telecommunications',
  'Energy', 'Transportation', 'Education', 'Government', 'Insurance', 'Real Estate'
];

const REGIONS = ['West', 'Central', 'East', 'All Intl', 'United States'];

const TECH_STACKS = [
  'Okta, Salesforce, AWS', 'Ping Identity, ServiceNow, Azure AD',
  'Duo Security, GitHub, Docker', 'ForgeRock, Oracle, Kubernetes',
  'Auth0, MongoDB, Jenkins', 'Azure AD, Microsoft 365, Slack',
  'Okta, Workday, Zoom', 'Ping Identity, SAP, Kubernetes'
];

const JOB_TITLES = [
  'Chief Information Security Officer', 'VP of Security', 'Security Director',
  'Head of Identity Management', 'Identity Architect', 'Security Engineer',
  'IT Director', 'CTO', 'VP of Engineering', 'Security Manager',
  'Identity Manager', 'Access Control Manager', 'Network Security Manager',
  'Cloud Security Engineer', 'Infrastructure Manager', 'IT Manager'
];

async function generateDemoData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'target_dashboard_demo'
  });

  try {
    console.log('🎬 Generating demo data...\n');

    // Generate 50 fictional accounts
    console.log('📊 Generating 50 fictional accounts...');
    const accountIds = [];
    for (let i = 0; i < 50; i++) {
      const company = FICTIONAL_COMPANIES[i];
      const employees = Math.floor(Math.random() * 50000) + 100;
      const intentScore = Math.floor(Math.random() * 30) + 65; // 65-95
      const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];
      const industry = INDUSTRIES[Math.floor(Math.random() * INDUSTRIES.length)];
      
      const query = `
        INSERT INTO accounts (
          name, domain, industry, employeeCount, region, intentScore,
          relationship, website, techStack, description, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      const [result] = await connection.execute(query, [
        company,
        company.toLowerCase().replace(/\s+/g, '') + '.com',
        industry,
        employees,
        region,
        intentScore,
        'Prospect',
        `https://${company.toLowerCase().replace(/\s+/g, '')}.com`,
        TECH_STACKS[Math.floor(Math.random() * TECH_STACKS.length)],
        `Fictional demo account for ${company}. This is test data for conference demo.`
      ]);
      
      accountIds.push(result.insertId);
    }
    console.log(`✅ Created 50 accounts\n`);

    // Generate 500 fictional contacts
    console.log('👥 Generating 500 fictional contacts...');
    for (let i = 0; i < 500; i++) {
      const accountId = accountIds[Math.floor(Math.random() * accountIds.length)];
      const company = FICTIONAL_COMPANIES[accountIds.indexOf(accountId)];
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const title = JOB_TITLES[Math.floor(Math.random() * JOB_TITLES.length)];
      
      const query = `
        INSERT INTO contacts (
          name, title, company, email, linkedinUrl, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      await connection.execute(query, [
        `${firstName} ${lastName}`,
        title,
        company,
        `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.toLowerCase().replace(/\s+/g, '')}.com`,
        `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}`
      ]);
      
      if ((i + 1) % 100 === 0) {
        process.stdout.write(`  ${i + 1}/500\r`);
      }
    }
    console.log(`✅ Created 500 contacts\n`);

    // Generate 50 fictional calls
    console.log('📞 Generating 50 fictional calls...');
    for (let i = 0; i < 50; i++) {
      const accountId = accountIds[Math.floor(Math.random() * accountIds.length)];
      const duration = Math.floor(Math.random() * 45) + 5; // 5-50 minutes
      
      const query = `
        INSERT INTO calls (
          accountId, duration, transcript, createdAt, updatedAt
        ) VALUES (?, ?, ?, NOW(), NOW())
      `;
      
      const transcript = `[DEMO CALL TRANSCRIPT]
Participant 1: Hi, thanks for joining the call today.
Participant 2: Thanks for having me. We're really interested in learning more about your identity management solution.
Participant 1: Great! Let me walk you through our key features...
[This is a fictional demo transcript for testing purposes]`;
      
      await connection.execute(query, [
        accountId,
        duration,
        transcript
      ]);
    }
    console.log(`✅ Created 50 calls\n`);

    console.log('🎉 Demo data generation complete!');
    console.log('\n📋 Summary:');
    console.log('  • 50 fictional accounts');
    console.log('  • 500 fictional contacts');
    console.log('  • 50 fictional calls');
    console.log('\n⚠️  This is completely fictional data for demo purposes only.');
    console.log('✅ Production database (Database 1) remains untouched.');

  } catch (error) {
    console.error('❌ Error generating demo data:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

generateDemoData();
