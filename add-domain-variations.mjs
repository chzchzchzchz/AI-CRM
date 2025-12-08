import Database from 'better-sqlite3';

const db = new Database('local.db');

try {
  // Add domainVariations column
  db.prepare(`ALTER TABLE accounts ADD COLUMN domainVariations JSON`).run();
  console.log('✓ Added domainVariations column to accounts table');
} catch (error) {
  if (error.message.includes('duplicate column name')) {
    console.log('✓ domainVariations column already exists');
  } else {
    console.error('Error:', error.message);
  }
}

db.close();
