# Demo Database Setup Guide

This document explains how to set up and switch between the production database (Database 1) and the demo database (Database 2) for conference demos and external presentations.

---

## Overview

**Database 1 (Production):** Real customer data, accounts, contacts, calls - NEVER MODIFIED
**Database 2 (Demo):** Completely fictional data for demos - Can be reset anytime

Both databases are stored permanently in Manus. You can switch between them with a single environment variable.

---

## Environment Variables

### Production (Default)
```env
DEMO_MODE=false
DATABASE_URL=mysql://user:password@host:3306/target_dashboard
```

### Demo
```env
DEMO_MODE=true
DATABASE_URL_DEMO=mysql://user:password@host:3306/target_dashboard_demo
```

---

## How It Works

The application automatically switches databases based on the `DEMO_MODE` flag:

1. **DEMO_MODE=false** (default) → Uses `DATABASE_URL` (Production Database 1)
2. **DEMO_MODE=true** → Uses `DATABASE_URL_DEMO` (Demo Database 2)

The switching logic is in `server/_core/env.ts`:

```typescript
demoMode: process.env.DEMO_MODE === "true",
databaseUrl: process.env.DEMO_MODE === "true" 
  ? (process.env.DATABASE_URL_DEMO ?? process.env.DATABASE_URL ?? "")
  : (process.env.DATABASE_URL ?? ""),
```

---

## Setting Up Demo Database

### Step 1: Create Database 2 Schema

Export the schema from Database 1 (production) and create Database 2 with the same structure:

```bash
# Export schema from production database
mysqldump -h [host] -u [user] -p[password] --no-data target_dashboard > schema.sql

# Create demo database
mysql -h [host] -u [user] -p[password] -e "CREATE DATABASE target_dashboard_demo;"

# Import schema into demo database
mysql -h [host] -u [user] -p[password] target_dashboard_demo < schema.sql
```

### Step 2: Populate Demo Database with Fictional Data

Run the data generation script:

```bash
cd /home/ubuntu/target-account-dashboard

# Set environment variables for demo database connection
export DB_HOST=[your_host]
export DB_USER=[your_user]
export DB_PASSWORD=[your_password]
export DB_NAME=target_dashboard_demo

# Run the demo data generator
node scripts/generate-demo-data.mjs
```

This generates:
- **50 fictional accounts** (TechVault Systems, CloudWave Solutions, etc.)
- **500 fictional contacts** (realistic names and job titles)
- **50 fictional calls** (sample transcripts)

All data is completely fictional with no real company information.

### Step 3: Update Environment Variables

In Manus Management UI → Settings → Secrets:

1. Add `DATABASE_URL_DEMO` with your demo database connection string
2. Set `DEMO_MODE=false` (default - uses production)

---

## Switching Between Databases

### For Conference Demo

1. Go to Manus Management UI → Settings → Secrets
2. Change `DEMO_MODE` from `false` to `true`
3. Restart the dev server or redeploy
4. App now uses Demo Database 2 with fictional data
5. Share the public URL with conference attendees

### Back to Production

1. Go to Manus Management UI → Settings → Secrets
2. Change `DEMO_MODE` from `true` to `false`
3. Restart the dev server
4. App now uses Production Database 1 with real data

---

## Resetting Demo Data

If you want to reset the demo database to a clean state:

### Option 1: Quick Reset (Delete and Regenerate)

```bash
# Connect to demo database
mysql -h [host] -u [user] -p[password] target_dashboard_demo

# Clear all data
TRUNCATE TABLE calls;
TRUNCATE TABLE contacts;
TRUNCATE TABLE accounts;
TRUNCATE TABLE users;

# Exit MySQL
exit

# Regenerate fictional data
export DB_HOST=[your_host]
export DB_USER=[your_user]
export DB_PASSWORD=[your_password]
export DB_NAME=target_dashboard_demo

node scripts/generate-demo-data.mjs
```

### Option 2: Full Rebuild

```bash
# Drop and recreate demo database
mysql -h [host] -u [user] -p[password] -e "DROP DATABASE target_dashboard_demo; CREATE DATABASE target_dashboard_demo;"

# Import fresh schema
mysql -h [host] -u [user] -p[password] target_dashboard_demo < schema.sql

# Regenerate data
export DB_HOST=[your_host]
export DB_USER=[your_user]
export DB_PASSWORD=[your_password]
export DB_NAME=target_dashboard_demo

node scripts/generate-demo-data.mjs
```

---

## Demo Data Contents

### Fictional Accounts (50 total)

Examples:
- TechVault Systems
- CloudWave Solutions
- SecureNet Inc
- DataShield Corp
- CyberGuard Technologies
- IdentityFlow Pro
- ZeroTrust Dynamics
- (And 42 more...)

Each account has:
- Realistic employee count (100-50,000)
- Intent score (65-95)
- Region (West, Central, East, All Intl, United States)
- Industry (Software, Finance, Healthcare, etc.)
- Tech stack (Okta, Ping Identity, Duo, Azure AD, etc.)

### Fictional Contacts (500 total)

Each contact has:
- Realistic first and last name
- Job title (CISO, VP Security, Security Engineer, etc.)
- Company (one of the 50 fictional accounts)
- Email address
- LinkedIn URL

### Fictional Calls (50 total)

Each call has:
- Associated fictional account
- Duration (5-50 minutes)
- Sample transcript (clearly marked as demo data)

---

## Important Notes

⚠️ **Production Database (Database 1):**
- Never modify directly
- Never delete or truncate
- Always verify you're in DEMO_MODE=false before making changes

✅ **Demo Database (Database 2):**
- Can be modified, deleted, reset freely
- Completely fictional data - no real customer info
- Safe to share externally at conferences

🔄 **Switching:**
- Takes effect immediately after environment variable change
- No data loss when switching
- Both databases remain intact

---

## Troubleshooting

### "DEMO_MODE is not configured"
- Go to Manus Settings → Secrets
- Add `DEMO_MODE=false` (or `true` for demo)

### "DATABASE_URL_DEMO is not configured"
- Go to Manus Settings → Secrets
- Add `DATABASE_URL_DEMO` with your demo database connection string

### Demo data generation fails
- Verify database connection: `mysql -h [host] -u [user] -p[password] target_dashboard_demo`
- Check that schema was imported correctly
- Ensure `scripts/generate-demo-data.mjs` has proper permissions

### Can't connect to demo database
- Verify `DATABASE_URL_DEMO` is correct in environment
- Check database user has proper permissions
- Ensure demo database exists: `mysql -h [host] -u [user] -p[password] -e "SHOW DATABASES;"`

---

## For Conference Demos

**Before the demo:**
1. Set `DEMO_MODE=true`
2. Restart server
3. Test all features work with demo data
4. Get the public URL from Manus

**During the demo:**
- Share the public URL with attendees
- All data is fictional - safe to show
- No company secrets exposed

**After the demo:**
1. Set `DEMO_MODE=false`
2. Restart server
3. Back to production database
4. Verify real data is intact

---

## Questions?

If you need to reset, switch, or modify the demo database, follow the steps above or contact your Manus administrator.
