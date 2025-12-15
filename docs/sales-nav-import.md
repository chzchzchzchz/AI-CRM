# Sales Navigator Contact Import Guide

LinkedIn Sales Navigator doesn't provide a public API, but there are several ways to import contacts into the Target Account Dashboard.

## Option 1: Manual CSV Export (Safest)

1. **In Sales Navigator:**
   - Go to Lead Lists or search results
   - Select contacts (up to 2,500 per export)
   - Click "Export to CSV"
   
2. **Prepare the CSV:**
   - Required columns: `First Name`, `Last Name`, `Title`, `Company`, `Email` (if available), `LinkedIn URL`
   - Optional: `Phone`, `Location`

3. **Import to Dashboard:**
   - Go to Admin → Data Import
   - Upload the CSV
   - Map columns to contact fields
   - Click Import

## Option 2: Clay Integration (Recommended)

Clay can safely scrape LinkedIn data through their proxy infrastructure:

1. **Set up Clay table** with your target accounts
2. **Use "Find People at Company" enrichment** - Clay will find contacts
3. **Export from Clay** or use the webhook integration
4. **Import via Clay webhook** - Already configured in the dashboard

### Clay Webhook URL:
```
POST /api/clay/webhook
```

## Option 3: Apollo.io / Cognism / Lusha

These data providers have LinkedIn data and proper APIs:

### Apollo.io
- Has email + phone data
- API available on paid plans
- Can search by company domain

### Cognism
- GDPR-compliant
- Direct dial phone numbers
- European coverage

### Lusha
- Chrome extension for quick lookups
- API for bulk enrichment

## Option 4: 6sense People Export

You already have 6sense - export more people data:

1. Go to 6sense → Reports → People
2. Filter by your target accounts
3. Export to CSV
4. Use the existing import script

## CSV Format for Import

The dashboard accepts CSVs with these columns:

```csv
"Account Name","Contact Name","Title","Email","Phone","LinkedIn URL"
"NVIDIA","John Smith","VP Engineering","john@nvidia.com","+1-555-1234","https://linkedin.com/in/johnsmith"
```

## Import Script Location

```bash
# Run the import
cd /home/ubuntu/target-account-dashboard
node server/import-6sense-data.mjs
```

## Accounts Currently Needing Contacts

See `/home/ubuntu/accounts-needing-contacts.csv` for the list of 125 accounts with 0 contacts.

Top priority accounts (by intent score):
1. Keller Williams Realty (94)
2. Nexidia (91)
3. Conagra Brands (70)
4. Drift (66)
5. Seamless.AI (61)
