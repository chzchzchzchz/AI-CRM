import mysql from 'mysql2/promise';
import 'dotenv/config';

console.log('🎭 Generating demo-safe data for CyberMarketingCon keynote...\n');

// Connect to MySQL/TiDB database
const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Clear existing data
console.log('1️⃣ Clearing real production data...');
await connection.execute('DELETE FROM calls');
await connection.execute('DELETE FROM contacts');
await connection.execute('DELETE FROM accounts');
await connection.execute('DELETE FROM rfps');
console.log('   ✅ Real data cleared (preserved in checkpoint b4365a1d)\n');

// Demo accounts data
const demoAccounts = [
  {
    name: 'AcmeCorp',
    domain: 'acmecorp.com',
    description: 'Leading provider of enterprise software solutions for Fortune 500 companies. Specializes in cloud-based productivity tools and AI-powered analytics.',
    industry: 'Software',
    employeeCount: 5000,
    region: 'West',
    intentScore: 95,
    relationship: 'Prospect',
    techStack: JSON.stringify(['Salesforce', 'AWS', 'Snowflake', 'Tableau']),
    triggerEvents: JSON.stringify(['New VP of Engineering hired', 'Announced $50M Series C funding', 'Expanding to EMEA region']),
    linkedinUrl: 'https://linkedin.com/company/acmecorp',
    domainVariations: JSON.stringify(['acmecorp.com', 'acmecorp.io', 'acme-corp.com'])
  },
  {
    name: 'GlobalTech Industries',
    domain: 'globaltech.com',
    description: 'Multinational technology conglomerate focused on cybersecurity, cloud infrastructure, and enterprise networking solutions.',
    industry: 'Software',
    employeeCount: 12000,
    region: 'East',
    intentScore: 88,
    relationship: 'Prospect',
    techStack: JSON.stringify(['Microsoft Azure', 'Okta', 'Splunk', 'Palo Alto Networks']),
    triggerEvents: JSON.stringify(['Acquired security startup for $200M', 'Launched new product line', 'CEO transition announced']),
    linkedinUrl: 'https://linkedin.com/company/globaltech',
    domainVariations: JSON.stringify(['globaltech.com', 'globaltech.io', 'global-tech.com'])
  },
  {
    name: 'Innovate Financial',
    domain: 'innovatefinancial.com',
    description: 'Digital-first financial services company providing banking, lending, and investment solutions to modern consumers.',
    industry: 'Finance',
    employeeCount: 3500,
    region: 'Central',
    intentScore: 72,
    relationship: 'Prospect',
    techStack: JSON.stringify(['Stripe', 'Plaid', 'MongoDB', 'React']),
    triggerEvents: JSON.stringify(['IPO filing announced', 'Expanded to 10 new states', 'Launched mobile app v2.0']),
    linkedinUrl: 'https://linkedin.com/company/innovatefinancial',
    domainVariations: JSON.stringify(['innovatefinancial.com', 'innovate-financial.com'])
  },
  {
    name: 'MedTech Solutions',
    domain: 'medtechsolutions.com',
    description: 'Healthcare technology company developing AI-powered diagnostic tools and patient management systems for hospitals.',
    industry: 'Software',
    employeeCount: 2800,
    region: 'East',
    intentScore: 91,
    relationship: 'Prospect',
    techStack: JSON.stringify(['Epic', 'Cerner', 'AWS HealthLake', 'TensorFlow']),
    triggerEvents: JSON.stringify(['FDA approval for new AI diagnostic tool', 'Partnership with Mayo Clinic', 'Raised $75M Series B']),
    linkedinUrl: 'https://linkedin.com/company/medtechsolutions',
    domainVariations: JSON.stringify(['medtechsolutions.com', 'medtech-solutions.com'])
  },
  {
    name: 'RetailMax',
    domain: 'retailmax.com',
    description: 'E-commerce platform and retail technology provider serving mid-market retailers with omnichannel solutions.',
    industry: 'Retail',
    employeeCount: 4200,
    region: 'West',
    intentScore: 65,
    relationship: 'Prospect',
    techStack: JSON.stringify(['Shopify Plus', 'BigCommerce', 'Google Cloud', 'Segment']),
    triggerEvents: JSON.stringify(['Black Friday sales up 45%', 'Opened new fulfillment center', 'Launched same-day delivery']),
    linkedinUrl: 'https://linkedin.com/company/retailmax',
    domainVariations: JSON.stringify(['retailmax.com', 'retail-max.com'])
  },
  {
    name: 'EnergyGrid Systems',
    domain: 'energygridsystems.com',
    description: 'Smart grid technology and renewable energy management software for utility companies and industrial facilities.',
    industry: 'Energy, Utilities & Waste',
    employeeCount: 1800,
    region: 'Central',
    intentScore: 78,
    relationship: 'Prospect',
    techStack: JSON.stringify(['IoT sensors', 'Azure IoT Hub', 'Power BI', 'SAP']),
    triggerEvents: JSON.stringify(['Awarded $100M government contract', 'Deployed in 50 cities', 'New CTO from Tesla']),
    linkedinUrl: 'https://linkedin.com/company/energygridsystems',
    domainVariations: JSON.stringify(['energygridsystems.com', 'energy-grid.com'])
  },
  {
    name: 'CloudScale Dynamics',
    domain: 'cloudscale.io',
    description: 'Cloud infrastructure and DevOps automation platform helping enterprises scale their applications globally.',
    industry: 'Software',
    employeeCount: 950,
    region: 'West',
    intentScore: 83,
    relationship: 'Prospect',
    techStack: JSON.stringify(['Kubernetes', 'Docker', 'Terraform', 'Datadog']),
    triggerEvents: JSON.stringify(['Named Gartner Cool Vendor', 'Customer base grew 200%', 'Opened European headquarters']),
    linkedinUrl: 'https://linkedin.com/company/cloudscale',
    domainVariations: JSON.stringify(['cloudscale.io', 'cloudscale.com', 'cloud-scale.io'])
  },
  {
    name: 'SecureAuth Pro',
    domain: 'secureauth.com',
    description: 'Identity and access management (IAM) solutions provider specializing in zero-trust security architectures.',
    industry: 'Software',
    employeeCount: 1200,
    region: 'East',
    intentScore: 89,
    relationship: 'Prospect',
    techStack: JSON.stringify(['Auth0', 'Okta', 'AWS Cognito', 'SAML/OAuth']),
    triggerEvents: JSON.stringify(['SOC 2 Type II certified', 'Partnership with Microsoft', 'Launched passwordless authentication']),
    linkedinUrl: 'https://linkedin.com/company/secureauth',
    domainVariations: JSON.stringify(['secureauth.com', 'secure-auth.com', 'secureauthpro.com'])
  },
  {
    name: 'DataFlow Analytics',
    domain: 'dataflowanalytics.com',
    description: 'Business intelligence and data analytics platform with real-time dashboards and predictive modeling capabilities.',
    industry: 'Software',
    employeeCount: 680,
    region: 'Central',
    intentScore: 76,
    relationship: 'Prospect',
    techStack: JSON.stringify(['Looker', 'dbt', 'Redshift', 'Apache Airflow']),
    triggerEvents: JSON.stringify(['Won Best Analytics Tool award', 'Customer count hit 500', 'Launched AI-powered insights']),
    linkedinUrl: 'https://linkedin.com/company/dataflowanalytics',
    domainVariations: JSON.stringify(['dataflowanalytics.com', 'dataflow-analytics.com'])
  },
  {
    name: 'ManufacturePro',
    domain: 'manufacturepro.com',
    description: 'Industrial IoT and manufacturing execution system (MES) software for smart factories and supply chain optimization.',
    industry: 'Manufacturing',
    employeeCount: 2100,
    region: 'Central',
    intentScore: 70,
    relationship: 'Prospect',
    techStack: JSON.stringify(['SAP MES', 'Siemens MindSphere', 'PTC ThingWorx', 'Oracle SCM']),
    triggerEvents: JSON.stringify(['Deployed in 25 factories', 'Reduced downtime by 40%', 'Expanded to automotive sector']),
    linkedinUrl: 'https://linkedin.com/company/manufacturepro',
    domainVariations: JSON.stringify(['manufacturepro.com', 'manufacture-pro.com'])
  }
];

// Insert demo accounts
console.log('2️⃣ Creating 10 demo accounts...');
const accountIds = [];
for (const account of demoAccounts) {
  const [result] = await connection.execute(
    `INSERT INTO accounts (
      name, domain, description, industry, employeeCount, region,
      intentScore, relationship, techStack, triggerEvents, linkedinUrl, domainVariations
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      account.name,
      account.domain,
      account.description,
      account.industry,
      account.employeeCount,
      account.region,
      account.intentScore,
      account.relationship,
      account.techStack,
      account.triggerEvents,
      account.linkedinUrl,
      account.domainVariations
    ]
  );
  accountIds.push(result.insertId);
  console.log(`   ✅ ${account.name} (Intent: ${account.intentScore})`);
}
console.log('');

// Demo contacts data (5 per account = 50 total)
const firstNames = ['Jane', 'John', 'Sarah', 'Michael', 'Emily', 'David', 'Lisa', 'Robert', 'Jennifer', 'William'];
const lastNames = ['Rivera', 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez'];
const titles = [
  'Chief Technology Officer',
  'VP of Engineering',
  'Director of Product',
  'Head of Data Science',
  'VP of Sales',
  'Chief Information Officer',
  'Director of IT',
  'VP of Operations',
  'Head of Security',
  'Director of Analytics'
];

console.log('3️⃣ Creating 50 demo contacts (5 per account)...');
let contactCount = 0;
for (let i = 0; i < accountIds.length; i++) {
  const accountId = accountIds[i];
  const account = demoAccounts[i];
  
  for (let j = 0; j < 5; j++) {
    const firstName = firstNames[j % firstNames.length];
    const lastName = lastNames[(i + j) % lastNames.length];
    const name = `${firstName} ${lastName}`;
    const title = titles[(i * 5 + j) % titles.length];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${account.domain}`;
    const phone = `+1-555-${String(i).padStart(3, '0')}-${String(j).padStart(4, '0')}`;
    const linkedinUrl = `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${i}${j}`;
    
    await connection.execute(
      `INSERT INTO contacts (
        accountId, firstName, lastName, name, title, email, phone, linkedinUrl
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [accountId, firstName, lastName, name, title, email, phone, linkedinUrl]
    );
    contactCount++;
  }
  console.log(`   ✅ ${account.name}: 5 contacts created`);
}
console.log(`   📊 Total: ${contactCount} contacts\n`);

// Demo calls data (2-3 per account = ~25 total)
console.log('4️⃣ Creating demo Gong calls...');
const callTitles = [
  'Discovery Call - Product Demo',
  'Technical Deep Dive - Architecture Review',
  'Executive Briefing - Strategic Alignment',
  'Pricing Discussion - Enterprise Plan',
  'Implementation Planning - Timeline Review'
];

let callCount = 0;
for (let i = 0; i < accountIds.length; i++) {
  const accountId = accountIds[i];
  const account = demoAccounts[i];
  const numCalls = i % 3 === 0 ? 3 : 2; // Some accounts have 3 calls, others 2
  
  for (let j = 0; j < numCalls; j++) {
    const daysAgo = Math.floor(Math.random() * 30) + 1;
    const callDate = new Date();
    callDate.setDate(callDate.getDate() - daysAgo);
    
    const duration = 1800 + Math.floor(Math.random() * 1800); // 30-60 minutes
    const sentiment = ['Positive', 'Very Positive', 'Neutral'][Math.floor(Math.random() * 3)];
    const keyTopics = JSON.stringify([
      'Product capabilities',
      'Integration requirements',
      'Security compliance',
      'Pricing and ROI'
    ]);
    const actionItems = JSON.stringify([
      'Send technical documentation',
      'Schedule follow-up with CTO',
      'Prepare custom demo environment'
    ]);
    
    await connection.execute(
      `INSERT INTO calls (
        accountId, title, duration, callDate, sentiment, keyTopics, actionItems, recordingUrl, transcriptUrl, gongCallId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        accountId,
        callTitles[j % callTitles.length],
        duration,
        callDate.toISOString(),
        sentiment,
        keyTopics,
        actionItems,
        `https://demo.gong.io/call/${i}${j}`,
        `https://demo.gong.io/transcript/${i}${j}`,
        `demo-call-${i}-${j}`
      ]
    );
    callCount++;
  }
  console.log(`   ✅ ${account.name}: ${numCalls} calls created`);
}
console.log(`   📊 Total: ${callCount} calls\n`);

// Generate AI cache for top 3 accounts
console.log('5️⃣ Generating AI Executive Summary cache for top accounts...');
const topAccounts = [0, 1, 3]; // AcmeCorp, GlobalTech, MedTech (highest intent)
for (const idx of topAccounts) {
  const accountId = accountIds[idx];
  const account = demoAccounts[idx];
  
  const aiSummary = `# Sales Intelligence Analysis: ${account.name}

## Executive Summary

${account.name} represents a high-value opportunity with an intent score of ${account.intentScore}. This ${account.industry} company with ${account.employeeCount.toLocaleString()} employees is actively researching solutions in our space.

## Key Insights

### Company Profile
- **Industry:** ${account.industry}
- **Size:** ${account.employeeCount.toLocaleString()} employees
- **Region:** ${account.region}
- **Intent Score:** ${account.intentScore} (${account.intentScore >= 85 ? 'Hot Lead' : account.intentScore >= 70 ? 'Warm Lead' : 'Cold Lead'})

### Strategic Context
${account.description}

### Recent Trigger Events
${JSON.parse(account.triggerEvents).map(event => `- ${event}`).join('\n')}

### Technology Stack
Current technologies in use:
${JSON.parse(account.techStack).map(tech => `- ${tech}`).join('\n')}

## Recommended Sales Play

### Phase 1: Initial Engagement (Week 1)
1. **Target Contacts:** Focus on VP of Engineering, CTO, and Director of Product
2. **Messaging:** Emphasize how our solution integrates with their existing ${JSON.parse(account.techStack)[0]} stack
3. **Value Proposition:** Highlight ROI and time-to-value based on similar ${account.industry} customers

### Phase 2: Technical Validation (Week 2-3)
1. **Demo Environment:** Prepare custom demo with ${account.industry}-specific use cases
2. **Proof of Concept:** Offer 30-day trial with dedicated support
3. **Security Review:** Provide compliance documentation (SOC 2, GDPR, etc.)

### Phase 3: Commercial Discussion (Week 4)
1. **Pricing:** Enterprise plan recommended for ${account.employeeCount.toLocaleString()} employees
2. **Contract Terms:** Standard 1-year with option for multi-year discount
3. **Success Metrics:** Define KPIs and success criteria upfront

## Next Steps
- Schedule discovery call with key stakeholders
- Send personalized deck highlighting ${account.industry} case studies
- Prepare technical architecture review for their ${JSON.parse(account.techStack)[0]} environment
`;

  await connection.execute(
    'UPDATE accounts SET aiOverviewCache = ?, aiCacheUpdatedAt = ? WHERE id = ?',
    [aiSummary, new Date().toISOString(), accountId]
  );
  console.log(`   ✅ ${account.name}: AI summary cached`);
}
console.log('');

// Summary
const [accountsResult] = await connection.execute('SELECT COUNT(*) as count FROM accounts');
const [contactsResult] = await connection.execute('SELECT COUNT(*) as count FROM contacts');
const [callsResult] = await connection.execute('SELECT COUNT(*) as count FROM calls');
const [hotLeadsResult] = await connection.execute('SELECT COUNT(*) as count FROM accounts WHERE intentScore >= 85');
const [warmLeadsResult] = await connection.execute('SELECT COUNT(*) as count FROM accounts WHERE intentScore >= 70 AND intentScore < 85');
const [coldLeadsResult] = await connection.execute('SELECT COUNT(*) as count FROM accounts WHERE intentScore < 70');

const stats = {
  accounts: accountsResult[0].count,
  contacts: contactsResult[0].count,
  calls: callsResult[0].count,
  hotLeads: hotLeadsResult[0].count,
  warmLeads: warmLeadsResult[0].count,
  coldLeads: coldLeadsResult[0].count
};

console.log('✅ Demo data generation complete!\n');
console.log('📊 Database Statistics:');
console.log(`   • Accounts: ${stats.accounts}`);
console.log(`   • Contacts: ${stats.contacts}`);
console.log(`   • Calls: ${stats.calls}`);
console.log(`   • Hot Leads (85+): ${stats.hotLeads}`);
console.log(`   • Warm Leads (70-84): ${stats.warmLeads}`);
console.log(`   • Cold Leads (<70): ${stats.coldLeads}`);
console.log('');
console.log('🎭 Dashboard is now ready for live CyberMarketingCon demo!');
console.log('💡 All data is generic and demo-safe - no real prospect information exposed.');
console.log('');
console.log('To restore real production data, rollback to checkpoint: b4365a1d');

await connection.end();
