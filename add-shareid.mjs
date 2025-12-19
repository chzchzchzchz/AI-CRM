import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // Check if column exists
  const [cols] = await conn.query(`SHOW COLUMNS FROM transcriptReports LIKE 'shareId'`);
  if (cols.length === 0) {
    console.log('Adding shareId column...');
    await conn.query(`ALTER TABLE transcriptReports ADD COLUMN shareId VARCHAR(64) NOT NULL DEFAULT ''`);
    console.log('Column added');
  } else {
    console.log('shareId column already exists');
  }
} catch (e) {
  console.log('Table may not exist yet:', e.message);
}

await conn.end();
