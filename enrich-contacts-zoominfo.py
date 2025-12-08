#!/usr/bin/env python3.11
import mysql.connector
import os
import json
import subprocess
from urllib.parse import urlparse

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

print('\n=== ZoomInfo Contact Email Enrichment ===\n')

# Get contacts without emails
cursor.execute('''
    SELECT c.id, c.name, c.firstName, c.lastName, c.title, c.linkedinUrl, 
           a.name as companyName, a.domain
    FROM contacts c
    JOIN accounts a ON c.accountId = a.id
    WHERE c.email IS NULL
    LIMIT 100
''')

contacts = cursor.fetchall()
print(f'Found {len(contacts)} contacts without emails\n')

enriched_count = 0
failed_count = 0

for contact in contacts:
    contact_id = contact['id']
    first_name = contact['firstName']
    last_name = contact['lastName']
    full_name = contact['name']
    company_name = contact['companyName']
    
    if not first_name or not last_name or not company_name:
        print(f'⚠️  Skipping {full_name} - missing name or company')
        failed_count += 1
        continue
    
    print(f'Enriching: {full_name} at {company_name}...')
    
    # Call ZoomInfo MCP to enrich contact
    try:
        # Use enrich_contact with contacts array
        input_data = json.dumps({
            "contacts": [{
                "firstName": first_name,
                "lastName": last_name,
                "company": company_name
            }]
        })
        
        result = subprocess.run(
            ['manus-mcp-cli', 'tool', 'call', 'enrich_contact', '--server', 'zoominfo', '--input', input_data],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            # Parse the result
            output = result.stdout
            
            # Try to extract email from output
            if 'email' in output.lower() or '@' in output:
                # Look for email pattern
                import re
                email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', output)
                
                if email_match:
                    email = email_match.group(0)
                    
                    # Update contact with email
                    cursor.execute('UPDATE contacts SET email = %s WHERE id = %s', (email, contact_id))
                    conn.commit()
                    
                    enriched_count += 1
                    print(f'  ✓ Found email: {email}')
                else:
                    failed_count += 1
                    print(f'  ✗ No email found in response')
            else:
                failed_count += 1
                print(f'  ✗ No email in response')
        else:
            failed_count += 1
            print(f'  ✗ API call failed: {result.stderr[:100]}')
    
    except subprocess.TimeoutExpired:
        failed_count += 1
        print(f'  ✗ Timeout')
    except Exception as e:
        failed_count += 1
        print(f'  ✗ Error: {str(e)[:100]}')
    
    # Stop after first batch
    if enriched_count + failed_count >= 10:
        print(f'\n... stopping after 10 attempts for testing ...\n')
        break

print(f'\n=== Summary ===')
print(f'Contacts enriched: {enriched_count}')
print(f'Failed: {failed_count}')

cursor.close()
conn.close()
