import { query } from './server/salesforce.ts';

// Query to get all custom fields on Account
const soql = `
  SELECT Id, Name, Website, Industry, NumberOfEmployees,
         BillingCity, BillingState, BillingCountry, Description, Type, Phone, OwnerId
  FROM Account
  WHERE IsDeleted = false
  LIMIT 1
`;

try {
  const result = await query(soql);
  if (result.records.length > 0) {
    const record = result.records[0];
    console.log('Sample Account Record:');
    console.log(JSON.stringify(record, null, 2));
    console.log('\nAvailable fields:');
    console.log(Object.keys(record).sort());
  }
} catch (error) {
  console.error('Error:', error.message);
}
