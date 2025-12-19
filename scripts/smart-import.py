#!/usr/bin/env python3
"""
Smart CSV importer that properly parses the combined accounts + contacts CSV.
The CSV has multi-line descriptions that break simple parsing.
"""

import csv
import json
import re
import sys

CSV_PATH = '/home/ubuntu/upload/DataCombination,wherethefirstcouplehundredrowsareaccounts,theniprovidesuggestedcontactsforthoseaccounts-6Sense-Target-Account-List-Default-view-export-1766150285846.csv.csv'

def parse_csv():
    accounts = []
    contacts = []
    
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            full_name = row.get('Full Name', '').strip()
            company_name = row.get('Company Name', '').strip()
            domain = row.get('Domain', '').strip()
            job_title = row.get('Job Title', '').strip()
            linkedin = row.get('Linked In Profile', '').strip()
            
            # Skip empty rows or rows that are part of multi-line descriptions
            if not company_name and not full_name:
                continue
            
            # If no full_name but has company_name - it's an ACCOUNT row
            if not full_name and company_name:
                account = {
                    'name': company_name,
                    'domain': domain,
                    'country': row.get('Country', '').strip(),
                    'revenue_range': row.get('Revenue Range', '').strip(),
                    'employee_range': row.get('Employee Range', '').strip(),
                    'buying_stage': row.get('6sense Buying Stage', '').strip(),
                    'industry': row.get('Industry', '').strip(),
                    'sso_vendors': row.get('SSO Vendors', '').strip(),
                    'mfa_vendors': row.get('MFA Vendors', '').strip(),
                    'description': row.get('Description', '').strip()[:2000] if row.get('Description') else '',
                    'employee_count': row.get('Employee Count', '').strip(),
                    'contact_record': row.get('Contact Record', '').strip(),
                    'gong_call_history': row.get('Gong Call History', '').strip(),
                }
                # Only add if it looks like a real account (has domain or reasonable name)
                if domain or (company_name and len(company_name) > 2 and not company_name.startswith('●')):
                    accounts.append(account)
            
            # If has full_name and looks like a person name - it's a CONTACT row
            elif full_name and not full_name.startswith('●') and not full_name.startswith('•'):
                # Check if it's actually a person name (not a description fragment)
                # Person names typically have first/last name pattern
                name_parts = full_name.split()
                if len(name_parts) >= 2 and len(name_parts) <= 5:
                    # Looks like a real name
                    first_name = row.get('First Name', '').strip()
                    last_name = row.get('Last Name', '').strip()
                    
                    # Skip if no job title and no linkedin - probably not a real contact
                    if not job_title and not linkedin:
                        continue
                    
                    contact = {
                        'full_name': full_name,
                        'first_name': first_name,
                        'last_name': last_name,
                        'linkedin': linkedin,
                        'job_title': job_title,
                        'company_name': company_name,
                        'domain': domain,
                        'intent_score': row.get('Contact Intent Score 6sense', '').strip(),
                    }
                    contacts.append(contact)
    
    return accounts, contacts

def main():
    print("Parsing CSV file...")
    accounts, contacts = parse_csv()
    
    print(f"\nFound {len(accounts)} accounts")
    print(f"Found {len(contacts)} contacts")
    
    # Save to JSON for import
    with open('/home/ubuntu/target-account-dashboard/scripts/parsed_accounts.json', 'w') as f:
        json.dump(accounts, f, indent=2)
    
    with open('/home/ubuntu/target-account-dashboard/scripts/parsed_contacts.json', 'w') as f:
        json.dump(contacts, f, indent=2)
    
    print("\nSample accounts:")
    for acc in accounts[:5]:
        print(f"  - {acc['name']} ({acc['domain']}) - {acc['industry']}")
    
    print("\nSample contacts:")
    for con in contacts[:10]:
        print(f"  - {con['full_name']} - {con['job_title']} at {con['company_name']}")

if __name__ == '__main__':
    main()
