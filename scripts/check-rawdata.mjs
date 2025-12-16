import mysql from "mysql2/promise";

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get a few accounts with rawData
  const [rows] = await connection.execute(
    "SELECT id, name, rawData FROM accounts WHERE rawData IS NOT NULL LIMIT 2"
  );
  
  console.log("Sample rawData structure:");
  rows.forEach(r => {
    console.log(`\n=== ${r.name} (ID: ${r.id}) ===`);
    if (r.rawData) {
      const data = typeof r.rawData === 'string' ? JSON.parse(r.rawData) : r.rawData;
      console.log("Keys:", Object.keys(data));
      console.log(JSON.stringify(data, null, 2).substring(0, 3000));
    }
  });
  
  await connection.end();
}

main().catch(console.error);
