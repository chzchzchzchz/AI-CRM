import mysql from 'mysql2/promise';
// Use axios to call LLM API directly
import axios from 'axios';

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

async function invokeLLM(params) {
  const response = await axios.post(
    `${FORGE_API_URL}/llm/chat/completions`,
    params,
    { headers: { 'Authorization': `Bearer ${FORGE_API_KEY}` } }
  );
  return response.data;
}

const DATABASE_URL = process.env.DATABASE_URL;

// Security-focused job titles for contact generation
const securityTitles = [
  'Chief Information Security Officer',
  'VP of Security',
  'Director of Information Security',
  'Head of Cybersecurity',
  'Security Architect',
  'Identity and Access Management Director',
  'Security Engineering Manager',
  'Information Security Manager',
  'Cybersecurity Director',
  'Chief Security Officer'
];

async function generateContacts() {
  console.log('👥 Generating contacts using AI...\n');
  
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Get all accounts
    const [accounts] = await connection.execute(
      'SELECT id, name, industry, employeeCount FROM accounts ORDER BY intentScore DESC LIMIT 200'
    );
    
    console.log(`📊 Found ${accounts.length} accounts\n`);
    console.log('🤖 Generating 2-3 security contacts per account using AI...\n');
    
    let totalContacts = 0;
    
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      const contactsPerAccount = account.employeeCount > 10000 ? 3 : 2;
      
      try {
        // Use AI to generate realistic contacts
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'You are a B2B data generator. Generate realistic security professional contacts for companies. Return ONLY valid JSON array, no markdown, no explanation.'
            },
            {
              role: 'user',
              content: `Generate ${contactsPerAccount} realistic security professional contacts for ${account.name} (${account.industry} industry, ${account.employeeCount} employees). 

Return JSON array with this exact structure:
[
  {
    "name": "First Last",
    "title": "Chief Information Security Officer",
    "linkedinUrl": "https://www.linkedin.com/in/firstlast",
    "location": "City, State, Country"
  }
]

Use realistic names, senior security titles (CISO, VP Security, Director), and appropriate locations for ${account.industry} companies.`
            }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'contacts',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  contacts: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        title: { type: 'string' },
                        linkedinUrl: { type: 'string' },
                        location: { type: 'string' }
                      },
                      required: ['name', 'title', 'linkedinUrl', 'location'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['contacts'],
                additionalProperties: false
              }
            }
          }
        });
        
        const content = response.choices[0].message.content;
        const data = JSON.parse(content);
        const contacts = data.contacts;
        
        // Insert contacts
        for (const contact of contacts) {
          await connection.execute(
            `INSERT INTO contacts (accountId, name, title, linkedinUrl, location, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              account.id,
              contact.name,
              contact.title,
              contact.linkedinUrl,
              contact.location
            ]
          );
          totalContacts++;
        }
        
        if ((i + 1) % 10 === 0) {
          console.log(`  ✓ Generated contacts for ${i + 1}/${accounts.length} accounts (${totalContacts} total contacts)`);
        }
        
        // Rate limit to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        console.error(`  ⚠️  Error generating contacts for ${account.name}: ${err.message}`);
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
