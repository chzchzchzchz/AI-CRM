import * as fs from 'fs';

const content = fs.readFileSync('/home/ubuntu/upload/Find-people-Table-Default-view-export-1765207530663.csv', 'utf-8');
const lines = content.split('\n');
const headers = lines[0].split('","').map(h => h.replace(/^"|"$/g, ''));

console.log('Headers:', headers);
console.log('\nWork Email column index:', headers.indexOf('Work Email'));
console.log('Find Work Email column index:', headers.indexOf('Find Work Email'));

// Parse first data row
const values = lines[1].split('","').map(v => v.replace(/^"|"$/g, ''));
console.log('\nFirst row data:');
console.log('First Name:', values[headers.indexOf('First Name')]);
console.log('Last Name:', values[headers.indexOf('Last Name')]);
console.log('Full Name:', values[headers.indexOf('Full Name')]);
console.log('Work Email:', values[headers.indexOf('Work Email')]);
console.log('Find Work Email:', values[headers.indexOf('Find Work Email')]);
console.log('Account Name:', values[headers.indexOf('Account Name')]);
console.log('Domain Name:', values[headers.indexOf('Domain Name')]);
