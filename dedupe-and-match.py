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
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()

def find_best_match(name, candidates, threshold=0.85):
    """Find best matching candidate for a name"""
    best_score = 0
    best_match = None
    
    for candidate in candidates:
        score = similarity(name, candidate['name'])
        if score > best_score and score >= threshold:
            best_score = score
            best_match = candidate
    
    return best_match, best_score

print('\n=== STEP 1: Deduplicating Contacts ===\n')

# Get all contacts
cursor.execute('SELECT * FROM contacts ORDER BY id')
all_contacts = cursor.fetchall()
print(f'Total contacts: {len(all_contacts)}')

# Find duplicates by exact name match
contact_groups = {}
for contact in all_contacts:
    name = contact['name']
    if name not in contact_groups:
        contact_groups[name] = []
    contact_groups[name].append(contact)

duplicates = {k: v for k, v in contact_groups.items() if len(v) > 1}
print(f'Duplicate contact names: {len(duplicates)}')

# Merge duplicates - keep the one with email, or first one
contacts_to_delete = []
for name, group in duplicates.items():
    # Sort by: has email, has LinkedIn, id (earliest)
    sorted_group = sorted(group, key=lambda x: (
        0 if x['email'] else 1,
        0 if x['linkedinUrl'] else 1,
        x['id']
    ))
    
    keeper = sorted_group[0]
    to_delete = sorted_group[1:]
    
    print(f'  Keeping contact {keeper["id"]}: {name} ({keeper["email"] or "no email"})')
    print(f'  Deleting {len(to_delete)} duplicates: {[c["id"] for c in to_delete]}')
    
    contacts_to_delete.extend([c['id'] for c in to_delete])

# Delete duplicate contacts
if contacts_to_delete:
    placeholders = ','.join(['%s'] * len(contacts_to_delete))
    cursor.execute(f'DELETE FROM contacts WHERE id IN ({placeholders})', contacts_to_delete)
    conn.commit()
    print(f'\n✓ Deleted {len(contacts_to_delete)} duplicate contacts\n')

print('\n=== STEP 2: Deduplicating Accounts ===\n')

# Get all accounts
cursor.execute('SELECT * FROM accounts ORDER BY id')
all_accounts = cursor.fetchall()
print(f'Total accounts: {len(all_accounts)}')

# Find duplicates by exact name match
account_groups = {}
for account in all_accounts:
    name = account['name']
    if name not in account_groups:
        account_groups[name] = []
    account_groups[name].append(account)

duplicates = {k: v for k, v in account_groups.items() if len(v) > 1}
print(f'Duplicate account names: {len(duplicates)}')

# Merge duplicates - keep the one with most data
accounts_to_delete = []
for name, group in duplicates.items():
    # Sort by: has domain, has description, id (earliest)
    sorted_group = sorted(group, key=lambda x: (
        0 if x['domain'] else 1,
        0 if x['description'] else 1,
        x['id']
    ))
    
    keeper = sorted_group[0]
    to_delete = sorted_group[1:]
    
    print(f'  Keeping account {keeper["id"]}: {name} ({keeper["domain"] or "no domain"})')
    print(f'  Deleting {len(to_delete)} duplicates: {[a["id"] for a in to_delete]}')
    
    # Update contacts to point to keeper
    for dup in to_delete:
        cursor.execute('UPDATE contacts SET accountId = %s WHERE accountId = %s', (keeper['id'], dup['id']))
    
    accounts_to_delete.extend([a['id'] for a in to_delete])

# Delete duplicate accounts
if accounts_to_delete:
    placeholders = ','.join(['%s'] * len(accounts_to_delete))
    cursor.execute(f'DELETE FROM accounts WHERE id IN ({placeholders})', accounts_to_delete)
    conn.commit()
    print(f'\n✓ Deleted {len(accounts_to_delete)} duplicate accounts\n')

print('\n=== STEP 3: Matching Gong Calls to Accounts ===\n')

# Get all calls and accounts
cursor.execute('SELECT * FROM calls')
all_calls = cursor.fetchall()
print(f'Total Gong calls: {len(all_calls)}')

cursor.execute('SELECT id, name FROM accounts')
accounts_list = cursor.fetchall()
print(f'Total accounts: {len(accounts_list)}')

calls_matched_to_accounts = 0
for call in all_calls:
    if call['accountId']:
        calls_matched_to_accounts += 1
        continue  # Already matched
    
    # Search for company name in call title
    title = call['title'] or ''
    
    best_match, score = find_best_match(title, accounts_list, threshold=0.7)
    
    if best_match:
        cursor.execute('UPDATE calls SET accountId = %s WHERE id = %s', (best_match['id'], call['id']))
        calls_matched_to_accounts += 1
        if calls_matched_to_accounts <= 20:
            print(f'  ✓ Matched call "{title[:50]}" → {best_match["name"]} (score: {score:.2f})')

conn.commit()
print(f'\n✓ Matched {calls_matched_to_accounts} calls to accounts\n')

print('\n=== STEP 4: Matching Gong Calls to Contacts ===\n')

# Get all contacts
cursor.execute('SELECT id, name, accountId FROM contacts')
contacts_list = cursor.fetchall()
print(f'Total contacts: {len(contacts_list)}')

# Get calls that have accountId
cursor.execute('SELECT * FROM calls WHERE accountId IS NOT NULL')
calls_with_accounts = cursor.fetchall()

calls_matched_to_contacts = 0
for call in calls_with_accounts:
    # Get contacts for this account
    account_contacts = [c for c in contacts_list if c['accountId'] == call['accountId']]
    
    if not account_contacts:
        continue
    
    # Search for person name in call title
    title = call['title'] or ''
    
    best_match, score = find_best_match(title, account_contacts, threshold=0.7)
    
    if best_match:
        cursor.execute('UPDATE calls SET contactId = %s WHERE id = %s', (best_match['id'], call['id']))
        calls_matched_to_contacts += 1
        if calls_matched_to_contacts <= 20:
            print(f'  ✓ Matched call "{title[:50]}" → {best_match["name"]} (score: {score:.2f})')

conn.commit()
print(f'\n✓ Matched {calls_matched_to_contacts} calls to contacts\n')

print('\n=== Summary ===')
print(f'Contacts deduplicated: {len(contacts_to_delete)}')
print(f'Accounts deduplicated: {len(accounts_to_delete)}')
print(f'Calls matched to accounts: {calls_matched_to_accounts}')
print(f'Calls matched to contacts: {calls_matched_to_contacts}')

cursor.close()
conn.close()
