const SIXSENSE_API_KEY = process.env.SIXSENSE_API_KEY;
console.log('API Key exists:', !!SIXSENSE_API_KEY);
console.log('API Key length:', SIXSENSE_API_KEY?.length || 0);

const response = await fetch(
  'https://epsilon.6sense.com/v3/company/details?domain=cisco.com',
  {
    headers: {
      Authorization: 'Token ' + SIXSENSE_API_KEY,
    },
  }
);

console.log('Status:', response.status);
const data = await response.json();
console.log('Response:', JSON.stringify(data, null, 2));
