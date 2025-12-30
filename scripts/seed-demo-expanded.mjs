import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
  user: process.env.DATABASE_URL?.split('://')[1]?.split(':')[0] || 'root',
  password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0] || '',
  database: process.env.DATABASE_URL?.split('/').pop() || 'test',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: 'Amazon RDS',
});

const demoAccounts = [
  { name: 'Demo_TechStart Inc', industry: 'Software', employees: 150, region: 'East', intentScore: 92 },
  { name: 'Demo_Acme Corp', industry: 'Technology', employees: 500, region: 'West', intentScore: 85 },
  { name: 'Demo_Global Finance', industry: 'Finance', employees: 2500, region: 'Central', intentScore: 78 },
  { name: 'Demo_HealthPlus', industry: 'Healthcare', employees: 800, region: 'South', intentScore: 65 },
  { name: 'Demo_RetailMax', industry: 'Retail', employees: 3000, region: 'North', intentScore: 45 },
  { name: 'Demo_CloudVault', industry: 'Cloud Computing', employees: 350, region: 'West', intentScore: 88 },
  { name: 'Demo_SecureNet', industry: 'Cybersecurity', employees: 200, region: 'East', intentScore: 95 },
  { name: 'Demo_DataFlow', industry: 'Analytics', employees: 450, region: 'Central', intentScore: 72 },
  { name: 'Demo_AutoTech', industry: 'Automotive', employees: 5000, region: 'Midwest', intentScore: 60 },
  { name: 'Demo_EduLearn', industry: 'Education', employees: 1200, region: 'South', intentScore: 55 },
  { name: 'Demo_MediCare', industry: 'Healthcare', employees: 900, region: 'East', intentScore: 82 },
  { name: 'Demo_FinanceHub', industry: 'Financial Services', employees: 2000, region: 'Central', intentScore: 75 },
  { name: 'Demo_LogisticsPro', industry: 'Logistics', employees: 1500, region: 'West', intentScore: 68 },
  { name: 'Demo_EnergyPlus', industry: 'Energy', employees: 3500, region: 'South', intentScore: 58 },
  { name: 'Demo_TeleComm', industry: 'Telecommunications', employees: 4000, region: 'North', intentScore: 70 },
  { name: 'Demo_ManufactureCo', industry: 'Manufacturing', employees: 2200, region: 'Midwest', intentScore: 62 },
  { name: 'Demo_RetailChain', industry: 'Retail', employees: 6000, region: 'Central', intentScore: 48 },
  { name: 'Demo_InsuranceGroup', industry: 'Insurance', employees: 1800, region: 'East', intentScore: 77 },
  { name: 'Demo_RealEstatePro', industry: 'Real Estate', employees: 600, region: 'West', intentScore: 64 },
  { name: 'Demo_TravelGlobal', industry: 'Travel & Hospitality', employees: 1100, region: 'South', intentScore: 56 },
];

async function seedDemoAccounts() {
  const connection = await pool.getConnection();
  
  try {
    // Delete existing demo accounts
    await connection.execute('DELETE FROM accounts WHERE name LIKE "Demo_%"');
    
    // Insert new demo accounts
    for (const account of demoAccounts) {
      await connection.execute(
        'INSERT INTO accounts (name, industry, employeeCount, region, intentScore, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        [account.name, account.industry, account.employees, account.region, account.intentScore]
      );
    }
    
    console.log(`✅ Seeded ${demoAccounts.length} demo accounts`);
  } catch (error) {
    console.error('❌ Error seeding demo accounts:', error.message);
  } finally {
    await connection.release();
    await pool.end();
  }
}

seedDemoAccounts();
