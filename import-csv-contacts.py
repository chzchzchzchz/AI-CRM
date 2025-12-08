#!/usr/bin/env python3.11
import pandas as pd
import mysql.connector
import os
from urllib.parse import urlparse
from difflib import SequenceMatcher

# Database connection
db_url = os.environ['DATABASE_URL']
parsed = urlparse(db_url)

conn = mysql.connector.connect(
    host=parsed.hostname,
    port=parsed.port or 3306,
    user=parsed.username,
    password=parsed.password,
    database=parsed.path[1:]
)
cursor = conn.cursor(dictionary=True)

def similarity(a, b):
    """Calculate similarity ratio between two strings"""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, str(a).lower().strip(), str(b).lower().strip()).ratio()

print('\n=== Importing Contact Emails from CSV Files ===\n')

# Load CSV files
sfdc_df = pd.read_csv('/home/ubuntu/upload/TargetAccountContacts-SFDCContactUpload.csv')
linkedin_df = pd.read_csv('/home/ubuntu/upload/TargetAccountContacts-LinkedInContactUpload.csv')

print(f'SFDC CSV: {len(sfdc_df)} contacts')
print(f'LinkedIn CSV: {len(linkedin_df)} contacts\n')

# Get all existing contacts
cursor.execute('SELECT id, name, firstName, lastName, email, accountId FROM contacts')
existing_contacts = cursor.fetchall()
print(f'Existing contacts in database: {len(existing_contacts)}\n')

# Get all accounts for matching
cursor.execute('SELECT id, name, domain FROM accounts')
accounts = cursor.fetchall()
account_by_name = {acc['name'].lower().strip(): acc for acc in accounts}

updated_count = 0
new_contacts_count = 0
skipped_count = 0

# Process SFDC CSV
print('=== Processing SFDC CSV ===\n')
for idx, row in sfdc_df.iterrows():
    email = row.get('Email Address')
    first_name = row.get('First Name')
    last_name = row.get('Last Name')
    job_title = row.get('Job Title')
    company_name = row.get('Company Name')
    linkedin_url = row.get('LinkedIn Contact Profile URL')
    phone = row.get('Direct Phone Number') or row.get('Mobile phone')
    
    if pd.isna(email) or not email or '@' not in str(email):
        skipped_count += 1
        continue
    
    email = str(email).strip()
    full_name = f"{first_name} {last_name}" if first_name and last_name else None
    
    # Try to find matching contact in database
    matched_contact = None
    best_score = 0
    
    for contact in existing_contacts:
        if contact['email'] == email:
            # Exact email match
            matched_contact = contact
            break
        
        # Try name matching
        if full_name and contact['name']:
            score = similarity(full_name, contact['name'])
            if score > best_score and score >= 0.85:
                best_score = score
                matched_contact = contact
    
    if matched_contact:
        # Update existing contact
        updates = []
        params = []
        
        if not matched_contact['email']:
            updates.append('email = %s')
            params.append(email)
        
        if phone and not pd.isna(phone):
            updates.append('phone = %s')
            params.append(str(phone))
        
        if linkedin_url and not pd.isna(linkedin_url):
            cursor.execute('SELECT linkedinUrl FROM contacts WHERE id = %s', (matched_contact['id'],))
            result = cursor.fetchone()
            if not result['linkedinUrl']:
                updates.append('linkedinUrl = %s')
                params.append(str(linkedin_url))
        
        if updates:
            params.append(matched_contact['id'])
            query = f"UPDATE contacts SET {', '.join(updates)} WHERE id = %s"
            cursor.execute(query, params)
            updated_count += 1
            if updated_count <= 10:
                print(f'  ✓ Updated: {full_name} ({email})')
    else:
        # New contact - find account
        account_id = None
        if company_name and not pd.isna(company_name):
            company_key = str(company_name).lower().strip()
            if company_key in account_by_name:
                account_id = account_by_name[company_key]['id']
        
        if account_id:
            cursor.execute('''
                INSERT INTO contacts (accountId, firstName, lastName, name, title, email, phone, linkedinUrl)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                account_id,
                first_name if not pd.isna(first_name) else None,
                last_name if not pd.isna(last_name) else None,
                full_name,
                job_title if not pd.isna(job_title) else None,
                email,
                phone if not pd.isna(phone) else None,
                linkedin_url if not pd.isna(linkedin_url) else None
            ))
            new_contacts_count += 1
            if new_contacts_count <= 10:
                print(f'  ✓ New contact: {full_name} ({email}) at {company_name}')
        else:
            skipped_count += 1

conn.commit()

# Process LinkedIn CSV
print(f'\n=== Processing LinkedIn CSV ===\n')
linkedin_updated = 0
for idx, row in linkedin_df.iterrows():
    email = row.get('email')
    first_name = row.get('firstname')
    last_name = row.get('lastname')
    job_title = row.get('jobtitle')
    company_name = row.get('employeecompany')
    
    if pd.isna(email) or not email or '@' not in str(email):
        continue
    
    email = str(email).strip()
    
    # Check if contact already exists
    cursor.execute('SELECT id FROM contacts WHERE email = %s', (email,))
    result = cursor.fetchone()
    
    if not result:
        # New contact from LinkedIn
        full_name = f"{first_name} {last_name}" if first_name and last_name else None
        account_id = None
        
        if company_name and not pd.isna(company_name):
            company_key = str(company_name).lower().strip()
            if company_key in account_by_name:
                account_id = account_by_name[company_key]['id']
        
        if account_id:
            cursor.execute('''
                INSERT INTO contacts (accountId, firstName, lastName, name, title, email)
                VALUES (%s, %s, %s, %s, %s, %s)
            ''', (
                account_id,
                first_name if not pd.isna(first_name) else None,
                last_name if not pd.isna(last_name) else None,
                full_name,
                job_title if not pd.isna(job_title) else None,
                email
            ))
            linkedin_updated += 1
            if linkedin_updated <= 10:
                print(f'  ✓ New from LinkedIn: {full_name} ({email})')

conn.commit()

print(f'\n=== Summary ===')
print(f'Existing contacts updated: {updated_count}')
print(f'New contacts from SFDC: {new_contacts_count}')
print(f'New contacts from LinkedIn: {linkedin_updated}')
print(f'Skipped (no email or account): {skipped_count}')
print(f'Total contacts enriched: {updated_count + new_contacts_count + linkedin_updated}')

cursor.close()
conn.close()
