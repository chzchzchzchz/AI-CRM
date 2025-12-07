import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

// Realistic first and last names
const firstNames = [
  'Michael', 'Sarah', 'David', 'Jennifer', 'James', 'Emily', 'Robert', 'Jessica',
  'John', 'Amanda', 'William', 'Lisa', 'Richard', 'Michelle', 'Joseph', 'Karen',
  'Thomas', 'Nancy', 'Charles', 'Betty', 'Christopher', 'Margaret', 'Daniel', 'Sandra',
  'Matthew', 'Ashley', 'Anthony', 'Kimberly', 'Mark', 'Donna', 'Donald', 'Carol',
  'Steven', 'Rebecca', 'Paul', 'Sharon', 'Andrew', 'Cynthia', 'Joshua', 'Kathleen',
  'Kenneth', 'Amy', 'Kevin', 'Angela', 'Brian', 'Melissa', 'George', 'Brenda',
  'Timothy', 'Anna', 'Ronald', 'Samantha', 'Edward', 'Katherine', 'Jason', 'Christine',
  'Jeffrey', 'Debra', 'Ryan', 'Rachel', 'Jacob', 'Catherine', 'Gary', 'Carolyn',
  'Nicholas', 'Janet', 'Eric', 'Ruth', 'Jonathan', 'Maria', 'Stephen', 'Heather',
  'Larry', 'Diane', 'Justin', 'Virginia', 'Scott', 'Julie', 'Brandon', 'Joyce'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
  'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
  'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy',
  'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey',
  'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson'
];

const securityTitles = [
  'Chief Information Security Officer',
  'VP of Information Security',
  'Director of Cybersecurity',
  'Head of Security',
  'Security Architect',
  'Director of Information Security',
  'VP of Cybersecurity',
  'Chief Security Officer',
  'Security Engineering Manager',
  'Identity and Access Management Director',
  'Information Security Manager',
  'Cybersecurity Director',
  'Senior Security Engineer',
  'Security Operations Manager',
  'Director of Security Engineering'
];

const cities = [
  'New York, NY', 'San Francisco, CA', 'Austin, TX', 'Seattle, WA', 'Boston, MA',
  'Chicago, IL', 'Los Angeles, CA', 'Denver, CO', 'Atlanta, GA', 'Dallas, TX',
  'Miami, FL', 'Portland, OR', 'Phoenix, AZ', 'San Diego, CA', 'Washington, DC',
  'Philadelphia, PA', 'Minneapolis, MN', 'Detroit, MI', 'Tampa, FL', 'Charlotte, NC',
  'Raleigh, NC', 'Nashville, TN', 'Salt Lake City, UT', 'Indianapolis, IN', 'Columbus, OH'
];

function generateName(seed) {
  const firstIdx = seed % firstNames.length;
  const lastIdx = Math.floor(seed / firstNames.length) % lastNames.length;
  return `${firstNames[firstIdx]} ${lastNames[lastIdx]}`;
}

function generateLinkedInUrl(name) {
  return `https://www.linkedin.com/in/${name.toLowerCase().replace(/ /g, '-')}`;
}

async function generateContacts() {
  console.log('👥 Generating contacts...\n');
  
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Get all accounts
    const [accounts] = await connection.execute(
      'SELECT id, name, employeeCount FROM accounts ORDER BY intentScore DESC'
    );
    
    console.log(`📊 Found ${accounts.length} accounts\n`);
    console.log('🔨 Generating 2-3 contacts per account...\n');
    
    let totalContacts = 0;
    let seed = 0;
    
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      const contactsPerAccount = account.employeeCount > 10000 ? 3 : 2;
      
      for (let j = 0; j < contactsPerAccount; j++) {
        const name = generateName(seed);
        const title = securityTitles[seed % securityTitles.length];
        const linkedinUrl = generateLinkedInUrl(name);
        const location = cities[seed % cities.length] + ', United States';
        
        try {
          await connection.execute(
            `INSERT INTO contacts (accountId, name, title, linkedinUrl, location, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [account.id, name, title, linkedinUrl, location]
          );
          totalContacts++;
          seed++;
        } catch (err) {
          // Skip duplicates
        }
      }
      
      if ((i + 1) % 50 === 0) {
        console.log(`  ✓ Generated contacts for ${i + 1}/${accounts.length} accounts (${totalContacts} total contacts)`);
      }
    }
    
    console.log(`\n✅ Generated ${totalContacts} contacts!\n`);
    
    // Final stats
    const [contactTotal] = await connection.execute('SELECT COUNT(*) as total FROM contacts');
    const [accountsWithContacts] = await connection.execute('SELECT COUNT(DISTINCT accountId) as total FROM contacts');
    
    console.log('📊 Final Stats:');
    console.log(`   Total Contacts: ${contactTotal[0].total}`);
    console.log(`   Accounts with Contacts: ${accountsWithContacts[0].total}`);
    console.log('\n✅ Contact generation complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

generateContacts();
