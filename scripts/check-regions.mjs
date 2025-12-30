import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT DISTINCT region, COUNT(*) as cnt FROM accounts GROUP BY region ORDER BY cnt DESC');
console.log('Regions:', JSON.stringify(rows, null, 2));
await conn.end();
