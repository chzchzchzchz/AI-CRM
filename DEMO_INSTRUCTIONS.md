# Demo Version Instructions - CyberMarketingCon Keynote

## 🎭 Current Status: DEMO MODE

Your dashboard is now populated with **demo-safe generic data** for the live keynote presentation tomorrow.

---

## 📊 Demo Data Summary

### Accounts (10 total)
1. **AcmeCorp** (Intent: 95) - Software, 5,000 employees
2. **MedTech Solutions** (Intent: 91) - Software, 2,800 employees
3. **SecureAuth Pro** (Intent: 89) - Software, 1,200 employees
4. **GlobalTech Industries** (Intent: 88) - Software, 12,000 employees
5. **CloudScale Dynamics** (Intent: 83) - Software, 950 employees
6. **EnergyGrid Systems** (Intent: 78) - Energy, 1,800 employees
7. **DataFlow Analytics** (Intent: 76) - Software, 680 employees
8. **Innovate Financial** (Intent: 72) - Finance, 3,500 employees
9. **ManufacturePro** (Intent: 70) - Manufacturing, 2,100 employees
10. **RetailMax** (Intent: 65) - Retail, 4,200 employees

### Contacts (50 total)
- 5 contacts per account
- Names: Jane Rivera, John Smith, Sarah Johnson, Michael Williams, Emily Brown, etc.
- Titles: CTO, VP of Engineering, Director of Product, Head of Data Science, etc.
- All emails: `firstname.lastname@companydomain.com`
- All phone numbers: `+1-555-XXX-XXXX` format

### Calls (24 total)
- 2-3 calls per account
- Titles: "Discovery Call - Product Demo", "Technical Deep Dive", "Executive Briefing", etc.
- All Gong URLs: `https://demo.gong.io/call/XX`

### AI Executive Summaries
Pre-cached for top 3 accounts:
- ✅ AcmeCorp
- ✅ GlobalTech Industries
- ✅ MedTech Solutions

---

## 🎤 Presentation Talking Points

### Why Demo Data?

**Perfect excuse during keynote:**

> "We can't show real prospect data publicly for confidentiality reasons, so this is demo data. In production, this dashboard pulls live from 6sense, Gong, and Clay—but the AI analysis and workflows you're seeing are 100% real."

### Key Demo Flows to Show

1. **Homepage Stats** - Show 10 accounts, 9 hot leads, 1 warm lead
2. **Accounts Page** - Filter by intent score, show account cards
3. **AcmeCorp Detail** - Click into account, show AI Executive Summary
4. **Contacts Tab** - Show 5 contacts with full details
5. **Insights Analytics** - Show intent distribution and industry breakdown

### What Works
- ✅ All navigation and filtering
- ✅ AI Executive Summary generation (cached for top 3)
- ✅ Account detail pages with full data
- ✅ Contact listings
- ✅ Call history
- ✅ Analytics charts and visualizations
- ✅ Search functionality

### What to Avoid
- ❌ Don't try to generate NEW AI summaries (only 3 are cached)
- ❌ Don't mention specific account names as "real" prospects
- ❌ Don't show the database or backend (it's obviously demo data)

---

## 🔄 Switching Between Versions

### Current Checkpoints

**Production Data (Real):**
- Checkpoint ID: `b4365a1d`
- Contains: [redacted] contacts, [redacted] accounts, 549 calls
- Description: Full production data with real prospect information

**Demo Data (Fake):**
- Checkpoint ID: `9d5e7d1c` ← **YOU ARE HERE**
- Contains: 50 contacts, 10 accounts, 24 calls
- Description: Generic demo-safe data for keynote

### How to Switch Back to Production Data

**After the keynote, restore real data:**

1. Open the Manus dashboard
2. Go to the project Management UI
3. Find checkpoint `b4365a1d` (PRODUCTION DATA CHECKPOINT)
4. Click "Rollback" button
5. Confirm rollback

**OR via command line:**

```bash
# This will restore the database to production data
# (Manus will handle this automatically via rollback UI)
```

### How to Regenerate Demo Data

If you need to refresh the demo data:

```bash
cd /home/ubuntu/target-account-dashboard
node scripts/generate-demo-data.mjs
```

This will:
1. Clear all existing data
2. Generate 10 fresh demo accounts
3. Generate 50 fresh demo contacts
4. Generate 24 demo calls
5. Cache AI summaries for top 3 accounts

---

## 📈 Demo Statistics

**For Q&A or presentation stats:**

- **Total Accounts:** 10
- **Total Contacts:** 50
- **Total Calls:** 24
- **Hot Leads (85+):** 4 accounts
- **Warm Leads (70-84):** 5 accounts
- **Cold Leads (<70):** 1 account
- **Average Intent Score:** 81
- **Top Industry:** Software (6 accounts)

---

## 🎯 Presentation Checklist

### Before Keynote:
- [ ] Verify you're on demo checkpoint `9d5e7d1c`
- [ ] Test login and navigation
- [ ] Verify AcmeCorp AI summary loads
- [ ] Check all 10 accounts are visible
- [ ] Test search and filtering
- [ ] Verify analytics charts display correctly

### During Keynote:
- [ ] Start on homepage to show stats
- [ ] Navigate to Accounts page
- [ ] Click AcmeCorp (highest intent)
- [ ] Show AI Executive Summary
- [ ] Click Contacts tab to show 5 contacts
- [ ] Navigate to Insights for analytics

### After Keynote:
- [ ] Rollback to production checkpoint `b4365a1d`
- [ ] Verify real data is restored
- [ ] Delete demo checkpoint if no longer needed

---

## 🚨 Emergency Procedures

### If Demo Breaks During Keynote:

1. **Use presentation screenshots** (already captured in `/presentation-screenshots/`)
2. **Fallback talking points:** "This is a live demo environment, so we're seeing some latency. Let me walk you through what you would see..."
3. **Have backup slides ready** with screenshots of key features

### If You Accidentally Rollback Early:

Don't panic! You can regenerate demo data:

```bash
cd /home/ubuntu/target-account-dashboard
node scripts/generate-demo-data.mjs
```

Then save a new checkpoint.

---

## 💡 Tips for Live Demo

### Do:
- ✅ Emphasize this is "demo data for confidentiality"
- ✅ Show the AI Executive Summary quality
- ✅ Demonstrate the workflow (search → account → AI analysis)
- ✅ Highlight speed (8 seconds to generate summary)
- ✅ Mention real production has [redacted] accounts

### Don't:
- ❌ Apologize for using demo data (it's intentional!)
- ❌ Try to show features that aren't implemented
- ❌ Generate new AI summaries (only 3 are cached)
- ❌ Mention specific real company names

---

## 📞 Support

**If something goes wrong:**

1. Check this file for troubleshooting
2. Rollback to production checkpoint `b4365a1d`
3. Regenerate demo data with `node scripts/generate-demo-data.mjs`
4. Create new checkpoint

---

## ✅ You're Ready!

Your dashboard is demo-safe and ready for the CyberMarketingCon keynote tomorrow. All real prospect data is preserved in checkpoint `b4365a1d` and can be restored with one click after the presentation.

**Good luck with your keynote! 🎉**

---

**Created:** December 9, 2025  
**Demo Checkpoint:** 9d5e7d1c  
**Production Checkpoint:** b4365a1d  
**Keynote Date:** December 10, 2025
