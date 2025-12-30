#!/usr/bin/env python3
"""
Import master data CSV - accounts and contacts combined
The CSV has accounts in the first rows (empty contact fields) and contacts below
"""

import csv
import json
import sys
import os

# Read the CSV file
csv_path = sys.argv[1] if len(sys.argv) > 1 else "/home/ubuntu/upload/DataCombination,wherethefirstcouplehundredrowsareaccounts,theniprovidesuggestedcontactsforthoseaccounts-6Sense-Target-Account-List-Default-view-export-1766150285846.csv.csv"

accounts = []
contacts = []

with open(csv_path, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    
    for row in reader:
        # Check if this is an account row (has Company Name in column 10 but no Full Name)
        full_name = row.get('Full Name', '').strip()
        company_name = row.get('Company Name', '').strip()
        account_name = row.get('Account Name', '').strip()
        domain = row.get('Domain', '').strip() or row.get('Domain Name', '').strip()
        
        # If no full name but has company info, it's an account
        if not full_name and (company_name or account_name):
            name = company_name or account_name
            if not name or name in ['CHECK', '#N/A', 'Unknown', '']:
                continue
                
            account = {
                'name': name,
                'domain': domain,
                'country': row.get('Country', ''),
                'revenue': row.get('Revenue Range', ''),
                'employeeRange': row.get('Employee Range', ''),
                'buyingStage': row.get('6sense Buying Stage', ''),
                'industry': row.get('Industry', ''),
                'ssoVendors': row.get('SSO Vendors', ''),
                'mfaVendors': row.get('MFA Vendors', ''),
                'description': row.get('Description', '')[:1000] if row.get('Description') else '',
                'employeeCount': row.get('Employee Count', ''),
                'contactRecords': row.get('Contact Record', ''),
                'gongCallHistory': row.get('Gong Call History', ''),
            }
            accounts.append(account)
        
        # If has full name, it's a contact
        elif full_name:
            contact = {
                'fullName': full_name,
                'firstName': row.get('First Name', ''),
                'lastName': row.get('Last Name', ''),
                'linkedIn': row.get('Linked In Profile', ''),
                'title': row.get('Job Title', ''),
                'accountName': account_name,
                'domain': domain,
                'intentScore': row.get('Contact Intent Score 6sense', ''),
                'country': row.get('Country', ''),
            }
            contacts.append(contact)

# Output results
print(f"Found {len(accounts)} accounts and {len(contacts)} contacts")

# Save to JSON files for import
with open('/home/ubuntu/target-account-dashboard/scripts/accounts-import.json', 'w') as f:
    json.dump(accounts, f, indent=2)

with open('/home/ubuntu/target-account-dashboard/scripts/contacts-import.json', 'w') as f:
    json.dump(contacts, f, indent=2)

print(f"Saved to accounts-import.json and contacts-import.json")

# Print sample
print("\n--- Sample Accounts ---")
for a in accounts[:3]:
    print(f"  {a['name']} | {a['domain']} | {a['buyingStage']} | {a['industry']}")

print("\n--- Sample Contacts ---")
for c in contacts[:3]:
    print(f"  {c['fullName']} | {c['title']} | {c['accountName']}")
