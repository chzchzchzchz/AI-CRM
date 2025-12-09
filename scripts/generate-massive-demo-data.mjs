import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

async function getDb() {
  return await createConnection(process.env.DATABASE_URL);
}

const REAL_NAMES = [
  // First names
  ["Jennifer", "Michael", "Sarah", "David", "Emily", "James", "Jessica", "Robert", "Ashley", "William",
   "Amanda", "Christopher", "Melissa", "Matthew", "Michelle", "Daniel", "Stephanie", "Joseph", "Nicole", "Andrew",
   "Elizabeth", "Ryan", "Lisa", "Brian", "Angela", "Kevin", "Amy", "Jason", "Rebecca", "Thomas",
   "Laura", "Timothy", "Rachel", "Eric", "Kimberly", "Jeffrey", "Heather", "Richard", "Samantha", "Mark",
   "Christina", "Steven", "Megan", "Charles", "Brittany", "Jonathan", "Katherine", "Paul", "Christine", "Anthony",
   "Danielle", "Kenneth", "Lauren", "Joshua", "Amber", "Brandon", "Kelly", "Gregory", "Andrea", "Scott",
   "Tiffany", "Benjamin", "Maria", "Samuel", "Lindsey", "Patrick", "Natalie", "Adam", "Victoria", "Nathan",
   "Courtney", "Justin", "Shannon", "Tyler", "Monica", "Aaron", "Crystal", "Jeremy", "Vanessa", "Jacob",
   "Erica", "Nicholas", "Allison", "Kyle", "Kathryn", "Zachary", "Diana", "Jordan", "Jacqueline", "Brandon",
   "Alexis", "Cody", "Chelsea", "Derek", "Kristen", "Travis", "Morgan", "Marcus", "Cassandra", "Bradley"],
  // Last names
  ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
   "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
   "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
   "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
   "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts",
   "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker", "Cruz", "Edwards", "Collins", "Reyes",
   "Stewart", "Morris", "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper",
   "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson",
   "Watson", "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes",
   "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long", "Ross", "Foster", "Jimenez"]
];

const JOB_TITLES = [
  "Chief Technology Officer", "VP of Engineering", "Director of Security", "Head of Infrastructure",
  "VP of Product", "Director of DevOps", "Chief Information Officer", "VP of IT Operations",
  "Director of Cloud Architecture", "Head of Data Science", "VP of Security", "Director of Platform Engineering",
  "Chief Security Officer", "VP of Identity & Access Management", "Director of Compliance",
  "Head of Application Security", "VP of Network Operations", "Director of IT Strategy",
  "Chief Data Officer", "VP of Enterprise Architecture", "Director of Systems Engineering",
  "Head of Technical Operations", "VP of Digital Transformation", "Director of Infrastructure Security",
  "Chief Innovation Officer", "VP of Technology Strategy", "Director of Cloud Security",
  "Head of DevSecOps", "VP of Platform Services", "Director of Identity Management",
  "Senior Security Architect", "Principal Engineer", "Lead Security Engineer", "Senior DevOps Engineer",
  "Staff Software Engineer", "Principal Security Consultant", "Lead Platform Engineer",
  "Senior Cloud Architect", "Principal DevOps Engineer", "Lead Infrastructure Engineer",
  "Security Engineering Manager", "IT Operations Manager", "Cloud Platform Manager",
  "Identity & Access Manager", "Compliance Manager", "Network Security Manager"
];

const COMPANY_NAMES = [
  "AcmeCorp", "GlobalTech Industries", "MedTech Solutions", "SecureAuth Pro", "CloudScale Dynamics",
  "EnergyGrid Systems", "DataFlow Analytics", "Innovate Financial", "ManufacturePro", "RetailMax",
  "HealthFirst Medical", "FinanceHub Corp", "TechVision Systems", "SmartLogistics Inc", "CyberShield Security",
  "QuantumData Labs", "NexGen Software", "PrimeHealth Group", "Velocity Networks", "Apex Global Financial",
  "Synergy Tech Solutions", "Horizon Cloud Services", "Catalyst Innovations", "Meridian Systems",
  "Vanguard Technologies", "Pinnacle Data Corp", "Summit Healthcare", "Frontier Financial Services",
  "Eclipse Software Group", "Zenith Manufacturing", "Atlas Logistics", "Titan Energy Solutions",
  "Omega Security Systems", "Delta Cloud Platform", "Sigma Analytics Corp", "Alpha Tech Ventures",
  "Beta Systems Integration", "Gamma Data Solutions", "Theta Networks Inc", "Epsilon Cloud Services",
  "Zeta Software Labs", "Eta Financial Group", "Iota Healthcare Systems", "Kappa Manufacturing",
  "Lambda Tech Solutions", "Mu Data Centers", "Nu Security Services", "Xi Platform Technologies",
  "Omicron Systems Corp", "Pi Analytics Group", "Rho Cloud Infrastructure", "Tau Digital Services"
];

const INDUSTRIES = ["Software", "Financial Services", "Healthcare", "Manufacturing", "Retail", "Energy", "Technology"];
const REGIONS = ["North America", "EMEA", "APAC", "LATAM"];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateName() {
  return `${randomElement(REAL_NAMES[0])} ${randomElement(REAL_NAMES[1])}`;
}

function generateEmail(name, domain) {
  const [first, last] = name.toLowerCase().split(" ");
  return `${first}.${last}@${domain}`;
}

function generatePhone() {
  return `+1-${randomInt(200, 999)}-${randomInt(200, 999)}-${randomInt(1000, 9999)}`;
}

function generateLinkedIn(name) {
  const [first, last] = name.toLowerCase().split(" ");
  return `https://linkedin.com/in/${first}-${last}-${randomInt(100, 999)}`;
}

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to database");
    process.exit(1);
  }

  console.log("🗑️  Clearing existing demo data...");
  await db.execute("DELETE FROM calls");
  await db.execute("DELETE FROM contacts");
  await db.execute("DELETE FROM accounts");

  console.log("🏢 Generating 50 demo accounts...");
  const accountIds = [];
  for (let i = 0; i < 50; i++) {
    const company = COMPANY_NAMES[i];
    const domain = company.toLowerCase().replace(/\s+/g, "") + ".com";
    const industry = randomElement(INDUSTRIES);
    const employeeCount = randomInt(500, 25000);
    const intentScore = randomInt(40, 95);
    
    const result = await db.execute(
      `INSERT INTO accounts (
        name, domain, industry, employeeCount, intentScore, region,
        description, techStack, triggerEvents, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        company,
        domain,
        industry,
        employeeCount,
        intentScore,
        randomElement(REGIONS),
        `${company} is a leading ${industry.toLowerCase()} company specializing in enterprise solutions.`,
        JSON.stringify(["Okta", "AWS", "Kubernetes", "Docker"]),
        JSON.stringify([`High intent score (${intentScore})`, "Active research phase"])
      ]
    );
    
    accountIds.push(result.insertId);
    console.log(`  ✓ Created ${company} (ID: ${result.insertId})`);
  }

  console.log("\n👥 Generating 200 contacts with REAL NAMES...");
  const contactIds = [];
  for (let i = 0; i < 200; i++) {
    const accountId = randomElement(accountIds);
    const accountResult = await db.execute("SELECT name, domain FROM accounts WHERE id = ?", [accountId]);
    const account = accountResult.rows[0];
    
    const name = generateName();
    const [firstName, lastName] = name.split(" ");
    const title = randomElement(JOB_TITLES);
    const email = generateEmail(name, account.domain);
    const phone = generatePhone();
    const linkedin = generateLinkedIn(name);
    
    const result = await db.execute(
      `INSERT INTO contacts (
        accountId, firstName, lastName, name, title, email, phone, linkedinUrl,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [accountId, firstName, lastName, name, title, email, phone, linkedin]
    );
    
    contactIds.push(result.insertId);
    if ((i + 1) % 50 === 0) {
      console.log(`  ✓ Created ${i + 1} contacts...`);
    }
  }
  console.log(`  ✓ Total: 200 contacts created`);

  console.log("\n📞 Generating 50 calls with transcripts...");
  const CALL_TITLES = [
    "Discovery Call - Security Requirements",
    "Technical Deep Dive - MFA Implementation",
    "Executive Briefing - Zero Trust Strategy",
    "Product Demo - Passwordless Authentication",
    "Follow-up Discussion - Compliance Requirements",
    "Architecture Review - Identity Platform",
    "Stakeholder Meeting - Budget & Timeline",
    "Technical Q&A - Integration Approach"
  ];

  const TRANSCRIPT_TEMPLATES = [
    `[00:00] Sales Rep: Thanks for taking the time today. I wanted to discuss your current authentication challenges.
[00:45] Customer: We're struggling with phishing attacks targeting our MFA system. Users are getting frustrated with SMS codes.
[02:15] Sales Rep: That's a common pain point. Have you considered phishing-resistant MFA like FIDO2?
[03:30] Customer: We've looked at it, but concerned about deployment complexity and user adoption.
[05:00] Sales Rep: Let me walk you through how our solution addresses both...`,
    
    `[00:00] Customer: Our board is pushing for Zero Trust, but we're not sure where to start.
[01:20] Sales Rep: Zero Trust starts with strong identity. What's your current IAM stack?
[02:45] Customer: We're on Okta for SSO, but still using legacy VPN for remote access.
[04:10] Sales Rep: That's exactly where we can help. Our device trust integrates with your existing Okta...`,
    
    `[00:00] Sales Rep: Following up on the demo last week. What questions came up from your security team?
[00:30] Customer: They want to understand the cryptographic approach and how it prevents credential theft.
[02:00] Sales Rep: Great question. Unlike passwords or OTPs, our solution uses asymmetric cryptography...
[04:30] Customer: How does this work with our existing SSO? We can't rip and replace.`,
    
    `[00:00] Customer: We need to meet FedRAMP requirements. Can you speak to your compliance posture?
[01:15] Sales Rep: Absolutely. We're currently pursuing FedRAMP High authorization...
[03:00] Customer: What about FIPS 140-2 validation for the cryptographic modules?
[04:20] Sales Rep: All our crypto is FIPS 140-2 Level 2 validated...`
  ];

  for (let i = 0; i < 50; i++) {
    const accountId = randomElement(accountIds);
    const contactId = randomElement(contactIds.filter(async (cid) => {
      const c = await db.execute("SELECT accountId FROM contacts WHERE id = ?", [cid]);
      return c.rows[0]?.accountId === accountId;
    }));
    
    const title = randomElement(CALL_TITLES);
    const transcript = randomElement(TRANSCRIPT_TEMPLATES);
    const duration = `${randomInt(15, 45)}:${randomInt(10, 59).toString().padStart(2, '0')}`;
    const daysAgo = randomInt(1, 30);
    const callDate = new Date();
    callDate.setDate(callDate.getDate() - daysAgo);
    
    await db.execute(
      `INSERT INTO calls (
        accountId, contactId, title, duration, callDate, transcriptUrl, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [accountId, contactId, title, duration, callDate, transcript]
    );
    
    if ((i + 1) % 10 === 0) {
      console.log(`  ✓ Created ${i + 1} calls...`);
    }
  }
  console.log(`  ✓ Total: 50 calls created`);

  console.log("\n✅ Demo data generation complete!");
  console.log(`   - 50 accounts`);
  console.log(`   - 200 contacts with real names`);
  console.log(`   - 50 calls with transcripts`);
  
  process.exit(0);
}

main().catch(console.error);
