#!/usr/bin/env python3.11
import pandas as pd
import mysql.connector
import os
from urllib.parse import urlparse

# Database connection
db_url = os.environ['DATABASE_URL']
parsed = urlparse(db_url)

conn = mysql.connector.connect(
    host=parsed.hostname,
    port=parsed.port or 3306,
    user=parsed.username,
    password=parsed.password,
    database=parsed.path[1:]  # Remove leading /
)
cursor = conn.cursor(dictionary=True)

print('\n=== Importing Real Contacts from CSV ===\n')

# Read contacts CSV
df = pd.read_csv('/home/ubuntu/upload/Find-people-Table-Default-view-export-1765207530663.csv')
print(f'Found {len(df)} contact rows in CSV\n')

# Get all accounts with domain variations
cursor.execute('SELECT id, name, domain, domainVariations FROM accounts')
accounts = cursor.fetchall()
print(f'Found {len(accounts)} accounts in database\n')

# Create domain to account mapping
domain_to_account = {}

for account in accounts:
    # Add primary domain
    if account['domain']:
        normalized = account['domain'].lower().strip().replace('www.', '')
        domain_to_account[normalized] = account['id']
    
    # Add domain variations
    if account['domainVariations']:
        import json
        try:
            variations = json.loads(account['domainVariations'])
            for variation in variations:
                normalized = variation.lower().strip().replace('www.', '')
                domain_to_account[normalized] = account['id']
        except:
            pass

print(f'Created domain mapping for {len(domain_to_account)} domains\n')

# Import contacts
imported = 0
skipped = 0
matched = 0
unmatched = 0

for idx, row in df.iterrows():
    # Extract contact data
    first_name = row.get('First Name')
    last_name = row.get('Last Name')
    full_name = row.get('Full Name') or f"{first_name} {last_name}".strip()
    title = row.get('Job Title')
    linkedin_url = row.get('LinkedIn Profile')
    location = row.get('Employee Location')
    company_name = row.get('Account Name')
    domain = row.get('Domain Name')
    
    # Try multiple email columns
    email = None
    email_columns = ['Work Email', 'Find Work Email', 'Find Work Email (2)', 'Find Work Email (3)', 
                     'Find Work Email (4)', 'Find email', 'Find Work Email (5)', 'Find Work Email (6)', 
                     'Find work email', 'Find work email (2)', 'Find Work Email (7)']
    for col in email_columns:
        if col in row and not pd.isna(row[col]) and '@' in str(row[col]):
            email = row[col]
            break
    
    # Clean email if present
    if email and not pd.isna(email) and '@' in str(email):
        email = str(email).strip()
        email = email.replace('✅', '').replace('❌', '').replace('Valid email', '').strip()
    else:
        email = None
    
    # Find matching account by email domain or company domain
    account_id = None
    
    # Try email domain first
    if email and '@' in email:
        email_domain = email.split('@')[1].lower().strip()
        normalized = email_domain.replace('www.', '')
        if normalized in domain_to_account:
            account_id = domain_to_account[normalized]
            matched += 1
    
    # Try company domain from CSV
    if not account_id and domain and not pd.isna(domain):
        normalized_domain = str(domain).lower().strip().replace('www.', '')
        if normalized_domain in domain_to_account:
            account_id = domain_to_account[normalized_domain]
            matched += 1
    
    # Skip if no account match
    if not account_id:
        unmatched += 1
        if unmatched <= 10:
            print(f'⚠️  No account match for: {full_name} ({company_name}) - domain: {domain}')
        continue
    
    # Insert contact
    cursor.execute('''
        INSERT INTO contacts (accountId, firstName, lastName, name, title, email, linkedinUrl, location)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    ''', (
        account_id,
        first_name if not pd.isna(first_name) else None,
        last_name if not pd.isna(last_name) else None,
        full_name if not pd.isna(full_name) else None,
        title if not pd.isna(title) else None,
        email,
        linkedin_url if not pd.isna(linkedin_url) else None,
        location if not pd.isna(location) else None
    ))
    
    imported += 1
    
    if imported <= 20:
        account_name = next((a['name'] for a in accounts if a['id'] == account_id), 'Unknown')
        print(f'✓ Imported: {full_name} ({email}) → {account_name}')

conn.commit()

print(f'\n=== Import Summary ===')
print(f'Total rows in CSV: {len(df)}')
print(f'Contacts imported: {imported}')
print(f'Contacts matched to accounts: {matched}')
print(f'Contacts skipped (no email): {skipped}')
print(f'Contacts unmatched (no account found): {unmatched}')

cursor.close()
conn.close()
