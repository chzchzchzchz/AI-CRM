                'stack': json.dumps(insights) if insights else None,
            }
            accounts.append(account)
    
    return accounts

def parse_people(filepath: str) -> List[Dict]:
    """Parse Find People CSV"""
    people = []
    seen_contacts = set()
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            full_name = clean_text(row.get('Full Name'))
            company = clean_text(row.get('Account Name'))
            
            if not full_name or not company:
                continue
            
            # Create unique key
            contact_key = f"{full_name.lower()}-{company.lower()}"
            if contact_key in seen_contacts:
                continue
            
            seen_contacts.add(contact_key)
            
            person = {
                'clayId': f"person-{contact_key}",
                'name': full_name,
                'title': clean_text(row.get('Job Title')),
                'email': None,  # Not in this CSV
                'linkedin': clean_text(row.get('LinkedIn Profile')),
                'location': clean_text(row.get('Employee Location')),
                'company': company,
                'domain': clean_text(row.get('Domain Name')),
                'region': clean_text(row.get('Region')),
            }
            people.append(person)
    
    return people

def parse_gong_calls(filepath: str) -> List[Dict]:
    """Parse Gong calls CSV"""
    calls = []
    seen_call_ids = set()
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            call_id = clean_text(row.get('Call ID'))
            if not call_id or call_id in seen_call_ids:
                continue
            
            seen_call_ids.add(call_id)
            
            # Parse call date
            call_date_str = clean_text(row.get('Call Date'))
            call_date = None
            if call_date_str:
                try:
                    call_date = datetime.fromisoformat(call_date_str.replace('Z', '+00:00'))
                except:
                    pass
            
            call = {
                'callId': call_id,
                'callDate': call_date.isoformat() if call_date else None,
                'duration': clean_text(row.get('Call Duration')),
                'title': clean_text(row.get('Call Title')),
                'link': clean_text(row.get('Call Link')),
                'transcript': clean_text(row.get('Call Transcript')),
                'summary': clean_text(row.get('Call Summary (Text)')) or clean_text(row.get('Call Analysis Summary')),
                'speakers': clean_text(row.get('Unique Speakers')),
                'company': clean_text(row.get('Counterparty Company Counterparty Company')) or clean_text(row.get('Counterparty Company')),
                'companyDomain': clean_text(row.get('Counterparty Company Counterparty Domain Name')),
            }
            calls.append(call)
    
    return calls

def merge_accounts(sfdc_accounts: List[Dict], bi_accounts: List[Dict]) -> List[Dict]:
    """Merge SFDC and the company accounts by domain"""
    merged = {}
    
    # Start with SFDC accounts (more complete)
    for acc in sfdc_accounts:
        merged[acc['domain']] = acc
    
    # Merge in the company data
    for acc in bi_accounts:
        domain = acc['domain']
        if domain in merged:
            # Merge stack data
            existing_stack = json.loads(merged[domain].get('stack') or '{}')
            new_stack = json.loads(acc.get('stack') or '{}')
            existing_stack.update(new_stack)
            merged[domain]['stack'] = json.dumps(existing_stack) if existing_stack else None
        else:
            # Add as new account