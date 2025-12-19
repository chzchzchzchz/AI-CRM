# Target Account Dashboard - Systems Audit Report
**Lead Systems Auditor Report**
**Date:** December 17, 2025

---

## Executive Summary

This audit evaluates the Target Account Dashboard implementation against the Phase 3-13 roadmap. The dashboard is functional with core features operational, but significant gaps exist in data integration, AI consistency, and feature completeness.

---

## 1. Database & Data Integrity Audit

### Current Data Counts (Verified)
| Metric | Count | Status |
|--------|-------|--------|
| Total Accounts | 135 (Zane's territory) / ~711 total | ✅ Active |
| Hot Leads (Intent 70+) | 25 | ✅ Verified |
| Warm Leads (40-69) | 74 | ✅ Verified |
| 6QA Opportunity Gap | 567 | ⚠️ Unworked |
| Contacts | ~4,000+ | ✅ Imported |
| Gong Calls | ~549 | ✅ Matched |

### Data Quality Issues
| Issue | Count | Severity |
|-------|-------|----------|
| Unknown Industry | ~332 accounts | 🟡 Medium |
| Missing SFDC IDs | ~279 accounts | 🟡 Medium |
| Missing Contact Emails | ~1,903 contacts | 🟡 Medium |

### 6sense Integration Status
- ✅ 6QA performance data imported (668 total, 101 worked, 567 unworked)
- ✅ Buying stage metrics imported
- ✅ Keyword performance data (50 keywords)
- ⚠️ `sixQAAccounts` table NOT in schema - data may be in `rawData` JSON field
- ⚠️ Real-time sync NOT implemented

### Gong Integration Status
- ✅ 549 calls matched to accounts using fuzzy company name search
- ✅ Call records have accountId populated
- ⚠️ Only 1 call matched to contactId (limited name data in titles)
- ❌ No transcript content stored (only URLs)
- ❌ AI analysis does NOT reference actual Gong transcripts

---

## 2. Phase Completion Analysis

### Phase 3: Homepage/Dashboard - **80% Complete**
- ✅ Priority Actions cards with real contact names
- ✅ Rep-specific filtering (Zane, Morgan, Miranda, Jeff, Dan, Kevin)
- ✅ Trending Intent Keywords
- ✅ This Week's Focus tasks
- ✅ Top Accounts Today
- ⚠️ VECTOR scoring NOT displayed on Priority Actions
- ❌ Last contact date NOT shown
- ❌ Response rates NOT tracked

### Phase 4: Account Detail Page - **75% Complete**
- ✅ Intelligence tab (consolidated Overview/Research/AI Insights)
- ✅ 6sense Intelligence section
- ✅ Executive Summary generation with caching
- ✅ Open in Salesforce button
- ⚠️ VECTOR scores calculated but NOT prominently displayed
- ❌ Buying stage badge NOT in header

### Phase 5: Contact Detail Page - **60% Complete**
- ✅ Contact info display
- ✅ Click-to-call buttons
- ⚠️ Missing email/phone/LinkedIn for many contacts
- ❌ No engagement history timeline

### Phase 6: Calls Page - **70% Complete**
- ✅ Call list display
- ✅ Log Call button
- ❌ No call detail modal with transcript
- ❌ No AI summary of call content

### Phase 7: Data Analytics Studio - **90% Complete**
- ✅ Intent Score Distribution chart (clickable)
- ✅ Top Industries chart (clickable)
- ✅ Geographic Distribution chart (clickable)
- ✅ Buying Stage Funnel (clickable)
- ✅ Click-to-filter functionality
- ✅ Filtered accounts table

### Phase 8: AI-Powered Outreach - **95% Complete**
- ✅ Single account/contact selection
- ✅ Sorted by intent score
- ✅ Contact auto-filter
- ✅ AI email generation (two-pass: strategy → email)
- ✅ Open in Gmail/Outlook buttons
- ✅ Copy to clipboard
- ✅ File attachment support
- ⚠️ 6sense data NOT used in email personalization

### Phase 9: AI Features - **70% Complete**
- ✅ AI Assistant chatbot (Support Bot)
- ✅ Deep-Think 2-layer architecture
- ✅ Executive Summary generation
- ✅ VECTOR scoring system
- ⚠️ Revenue Architect persona NOT consistently applied
- ❌ AI does NOT reference real Gong transcripts
- ❌ No standardized output structure enforced

### Phase 10: Search & Filtering - **40% Complete**
- ✅ Basic search on Accounts/Contacts pages
- ❌ Global search (⌘K) NOT implemented
- ❌ Advanced multi-select filters partial
- ❌ Saved filter presets NOT implemented

### Phase 11: Data Import - **85% Complete**
- ✅ Accounts imported from SFDC CSV
- ✅ Contacts imported from multiple CSVs
- ✅ Gong calls imported
- ✅ 6sense data imported
- ⚠️ Some data quality issues remain

### Phase 12: Integrations - **30% Complete**
- ⚠️ 6sense: Import only, no real-time sync
- ❌ Gong: No live integration
- ❌ Clay: Webhook handler exists but not tested
- ❌ Zapier: Not implemented

### Phase 13: Testing & Polish - **50% Complete**
- ✅ 6/6 vitest tests passing
- ✅ 0 TypeScript errors
- ⚠️ Some UI polish needed
- ❌ Comprehensive test coverage missing

---

## 3. AI Consistency Audit

### Revenue Architect Persona
**Status: NOT IMPLEMENTED**

The "Revenue Architect" persona is mentioned in documentation but NOT found in any AI prompts. Current prompts use:
- "sales intelligence AI"
- "sales email writer"
- "sales intelligence analyst"
- "tactical sales strategist"

**Recommendation:** Create standardized `REVENUE_ARCHITECT_PERSONA` constant and apply to all 20+ LLM calls.

### AI Prompt Standardization
| Endpoint | Persona Used | Standardized Output | Uses Real Data |
|----------|--------------|---------------------|----------------|
| generateAccountInsights | sales intelligence AI | ❌ No | ⚠️ Partial |
| generateOutreachEmail | sales email writer | ❌ No | ⚠️ Partial |
| generateExecutiveSummary | sales intelligence analyst | ⚠️ Partial | ✅ Yes |
| generateStrategicInsights | B2B sales intelligence analyst | ✅ Yes (VECTOR) | ✅ Yes |
| deepThink.sales | tactical sales strategist | ✅ Yes | ✅ Yes |

### Missing AI Features
1. ❌ Gong transcript analysis NOT implemented
2. ❌ Standardized output structure NOT enforced (Executive Summary, Stakeholders Table, Talking Points, Next Actions, Risks)
3. ❌ Citation tracking NOT implemented
4. ⚠️ Real contact names used but NOT consistently prioritized

---

## 4. VECTOR Scoring Integration Audit

### Current Implementation
- ✅ `vectorScoring.ts` module exists with 4 dimensions:
  - Engagement (0-100)
  - Conversion (0-100)
  - Strategic Value (0-100)
  - Timing (0-100)
- ✅ Composite score with weighted average
- ✅ Tier assignment (1-6)
- ✅ Used in `generateStrategicInsights` endpoint

### Integration Gaps
| Page/Component | VECTOR Integrated | Status |
|----------------|-------------------|--------|
| Home Page Priority Actions | ❌ No | Missing |
| Account Detail Header | ❌ No | Missing |
| Account List | ❌ No | Missing |
| Contact Prioritization | ⚠️ Partial | Needs work |
| AI Insights | ✅ Yes | Working |

**Recommendation:** Add VECTOR score badges to Priority Actions cards and Account list.

---

## 5. Priority Actions Enhancement Audit

### Current State
- ✅ Shows account name, intent score, industry, region
- ✅ Shows top 3 contacts with names and titles
- ✅ Shows "Why Now" reasoning
- ✅ Shows "Next Best Action"
- ✅ Shows contact count

### Missing Features
| Feature | Status | Priority |
|---------|--------|----------|
| VECTOR score display | ❌ Missing | HIGH |
| Key titles highlighted | ⚠️ Partial | MEDIUM |
| Last contact date | ❌ Missing | HIGH |
| Response rates | ❌ Missing | MEDIUM |
| Live AI scoring updates | ❌ Missing | LOW |

### Recommended Format
```
ENGAGE UKG - VECTOR: 78/100 (Tier 2)
Intent: 85 | Software | 15,000 employees | East
Contact: [redacted] [redacted] (VP CSO) | Last: Dec 10, 2025
5 contacts | 3 calls | 2 responses (67% rate)
```

---

## 6. Risk Assessment: 567 Unworked 6QA Accounts

### Risk Level: HIGH

**Analysis:**
- 567 out of 668 6QA accounts (85%) are unworked
- These are accounts that 6sense has identified as in-market
- Represents significant pipeline leakage

**Root Causes:**
1. No automated assignment to reps
2. No alert/notification system
3. No prioritization within unworked pool
4. No tracking of "worked" status updates

**Recommendations:**
1. **Immediate:** Create daily digest of top 10 unworked 6QAs per rep
2. **Short-term:** Add "Mark as Worked" button to account detail
3. **Medium-term:** Implement automated rep assignment based on territory
4. **Long-term:** Build workflow automation to track engagement

---

## 7. Critical Bugs Identified

| Bug | Severity | Status |
|-----|----------|--------|
| Reload insights button not working | 🔴 High | Open |
| 157 contacts showing in AI insights (should be 10) | 🟡 Medium | Open |
| Lost Opp context missing | 🟡 Medium | Open |
| 6sense Intelligence not updating on Outreach page | 🟡 Medium | Open |
| Executive Summary loading timeout | 🟡 Medium | Open |

---

## 8. Recommendations Summary

### Immediate (This Week)
1. Fix Reload insights button (cache invalidation)
2. Limit contacts in AI insights to top 10
3. Add VECTOR scores to Priority Actions
4. Add last contact date to Priority Actions

### Short-term (Next 2 Weeks)
1. Implement Revenue Architect persona consistently
2. Standardize AI output structure
3. Add engagement metrics (response rates)
4. Create 6QA unworked account alerts

### Medium-term (Next Month)
1. Implement global search (⌘K)
2. Add Gong transcript analysis
3. Build Document RAG knowledge base
4. Create email history tracking

---

## Appendix: File Inventory

### Server Files (54 total)
- Core routers: `routers.ts`, `priority-actions-router.ts`, `sixsense-router.ts`
- AI modules: `ai.ts`, `aiContext.ts`, `deep-think.ts`, `vectorScoring.ts`
- Integration: `clay.ts`, `sixsense.ts`, `gemini.ts`
- Utilities: `domainMatcher.ts`, `contact-matcher.ts`, `repAssignment.ts`

### Client Pages (Verified)
- Home.tsx (Dashboard)
- Accounts.tsx (Account list)
- AccountDetail.tsx (Account detail)
- Contacts.tsx (Contact list)
- ContactDetail.tsx (Contact detail)
- Calls.tsx (Call list)
- Outreach.tsx (Email generation)
- Insights.tsx (Analytics)

---

**Audit Completed By:** Lead Systems Auditor
**Next Review Date:** January 17, 2026


---

# UPDATED AUDIT - December 19, 2025

## New Database Findings

### Table Row Counts (Updated)
| Table | Previous | Current | Change |
|-------|----------|---------|--------|
| accounts | 711 | 722 | +11 |
| contacts | 4,000 | 14,425 | +10,425 ✅ |
| calls | 549 | 33,225 | +32,676 ✅ |
| sixsenseKeywords | 50 | 50 | Same |

### Critical Data Issues

#### 1. CALLS NOT LINKED TO ACCOUNTS (33,225 calls)
**Status: CRITICAL - 100% of calls have no accountId**

All 33,225 calls are sitting unlinked. This is massive sales intelligence going unused.

**Fix Strategy:**
- Match call titles to account names (fuzzy matching)
- Match participant emails to account domains
- Match participant names to contacts

#### 2. CALLS MISSING TRANSCRIPTS (33,225 calls)
**Status: CRITICAL - 100% of calls have no transcript**

Without transcripts, we can't:
- Analyze call content
- Extract key topics
- Generate AI summaries
- Search call content

**Fix Strategy:**
- If Gong URLs exist, fetch transcripts via API
- If no URLs, mark as "transcript unavailable"

#### 3. CONTACTS MISSING LINKEDIN (10,108 contacts - 70%)
**Status: HIGH - Limits social selling**

**Fix Strategy:**
- Bulk enrich via Clay/Apollo
- Add LinkedIn lookup to contact detail page
- Prioritize enrichment for high-intent accounts

#### 4. CONTACTS MISSING EMAIL (1,972 contacts - 14%)
**Status: HIGH - Can't reach these contacts**

**Fix Strategy:**
- Bulk email finder via Clay/Hunter
- Flag contacts as "needs email" in UI
- Prioritize for high-value accounts

### Empty Tables That Need Activation

| Table | Purpose | How to Activate |
|-------|---------|-----------------|
| rfps | Government opportunities | Enable SAM.gov scraper |
| sixsense6QA | Qualified accounts | Import from 6sense CSV |
| emailHistory | Track sent emails | Save on email generation |
| aiChatHistory | Chat continuity | Save chat messages |
| knowledgeBase | RAG documents | Upload sales collateral |
| generatedContent | Track AI output | Save all generations |
| transcriptReports | Call analyses | Save transcript analyses |

---

## Action Items Added to Plan

### Phase 1: Link Calls to Accounts
- [ ] Create call-to-account matching script
- [ ] Match by company name in title
- [ ] Match by participant email domain
- [ ] Update 33,225 calls with accountId

### Phase 2: Enrich Missing Contact Data
- [ ] Identify 1,972 contacts missing email
- [ ] Identify 10,108 contacts missing LinkedIn
- [ ] Create bulk enrichment endpoint
- [ ] Add "needs enrichment" flag to UI

### Phase 3: Activate Empty Tables
- [ ] Start saving emailHistory on generation
- [ ] Start saving aiChatHistory on chat
- [ ] Start saving generatedContent on AI output
- [ ] Start saving transcriptReports on analysis
- [ ] Add knowledge base upload UI

### Phase 4: Surface Unused Data
- [ ] Show accounts.triggerEvents on account page
- [ ] Show accounts.securityStack in tech analysis
- [ ] Use accounts.rawData for additional insights
- [ ] Use contacts.department for persona targeting


---

## Frontend Component Audit

### Duplicate Components Found (23 total)
Components that exist in multiple locations:
- `GlobalAIChat.tsx` - components/ AND components/ui/
- `AIChatBox.tsx` - components/ AND components/ui/
- `AIAssistant.tsx` - components/ AND components/ui/
- `Calls.tsx` - pages/ AND components/ui/
- `Contacts.tsx` - pages/ AND components/ui/
- `Insights.tsx` - pages/ AND components/ui/

### Potentially Unused Components (3,866 lines)
| Component | Lines | Status |
|-----------|-------|--------|
| ComponentShowcase.tsx | 1,437 | Dev tool - keep for reference |
| Insights.tsx (ui/) | 451 | Duplicate of pages/Insights |
| SequenceBuilder.tsx | 414 | Built but not wired up |
| Contacts.tsx (ui/) | 392 | Duplicate of pages/Contacts |
| Calls.tsx (ui/) | 377 | Duplicate of pages/Calls |
| CallsEnhanced.tsx | 370 | Enhanced version not used |
| ContactsEnhanced.tsx | 314 | Enhanced version not used |
| SmartSearch.tsx (ui/) | 111 | Duplicate exists |

### Largest Files (Potential Bloat)
| File | Lines | Notes |
|------|-------|-------|
| ComponentShowcase.tsx | 1,437 | Dev showcase - useful for reference |
| Insights.tsx | 1,000 | Analytics dashboard - justified |
| AITools.tsx | 883 | AI tools hub - justified |
| sidebar.tsx | 734 | shadcn component - keep |
| Outreach.tsx | 637 | Email generation - justified |
| CsvProcessor.tsx | 619 | Data import - justified |

### Recommendations

#### 1. Consolidate Duplicates
- Keep `components/GlobalAIChat.tsx`, remove `components/ui/GlobalAIChat.tsx`
- Keep `components/AIChatBox.tsx`, remove `components/ui/AIChatBox.tsx`
- Keep `pages/Calls.tsx`, consider merging enhancements from `ui/Calls.tsx`
- Keep `pages/Contacts.tsx`, consider merging enhancements from `ui/Contacts.tsx`

#### 2. Wire Up Unused Features
- `SequenceBuilder.tsx` - Add to UI for email sequences
- `CallsEnhanced.tsx` - Has better features, merge into main Calls page
- `ContactsEnhanced.tsx` - Has better features, merge into main Contacts page

#### 3. Keep for Reference
- `ComponentShowcase.tsx` - Useful for seeing all available components


---

## Data Flow Analysis

### Hidden Data in rawData (Not Surfaced in UI)
These valuable fields exist in the rawData JSON but aren't displayed anywhere:

| Field | Value | Where to Show |
|-------|-------|---------------|
| `accountOwner` | Rep assignment | Account header, filters |
| `accountReach` | Reach score | Account card |
| `daysSinceLastEngagement` | Days since activity | Priority Actions |
| `engagementActivities` | Activity count | Account detail |
| `lastSalesActivity` | Last activity date | Account card, Priority |
| `lastSalesActivityDays` | Days since activity | Priority Actions |
| `latestEngagementActivity` | Recent activity type | Account timeline |
| `opportunityStatus` | Opp stage | Account header |
| `salesActivities` | Activity count | Account metrics |
| `temperature` | Hot/Warm/Cold | Account card badge |
| `Recent Security Incidents` | Security events | Account intel |
| `SSO Provider` | Identity provider | Tech stack |

### Account Fields Not Displayed
| Field | In Schema | In UI | Action |
|-------|-----------|-------|--------|
| triggerEvents | ✅ | ❌ | Add to account intel |
| sixsenseSegments | ✅ | ❌ | Add to 6sense section |
| securityStack | ✅ | Partial | Expand in tech analysis |
| domainVariations | ✅ | ❌ | Use for domain matching |

### Contact Fields Not Displayed
| Field | In Schema | In UI | Action |
|-------|-----------|-------|--------|
| department | ✅ | ❌ | Add to contact card |
| mobilePhone | ✅ | ❌ | Add to contact detail |
| directPhone | ✅ | ❌ | Add to contact detail |

### Call Fields Not Used
| Field | In Schema | In UI | Action |
|-------|-----------|-------|--------|
| sentiment | ✅ | ❌ | Add sentiment badge |
| keyTopics | ✅ | ❌ | Show as tags |
| actionItems | ✅ | ❌ | Show in call detail |

---

## Priority Fix List

### CRITICAL (Do First)
1. **Link 33,225 calls to accounts** - Match by company name/domain
2. **Surface rawData fields** - Show temperature, lastActivity, accountOwner
3. **Display triggerEvents** - Show on account intelligence tab

### HIGH (This Week)
4. **Add contact department** - Better persona targeting
5. **Show call sentiment/topics** - Quick call insights
6. **Display 6sense segments** - Better targeting
7. **Merge enhanced components** - CallsEnhanced, ContactsEnhanced

### MEDIUM (Next Sprint)
8. **Wire up SequenceBuilder** - Email sequences feature
9. **Activate empty tables** - Start saving emailHistory, generatedContent
10. **Enrich missing contact data** - Emails, LinkedIn

### LOW (Backlog)
11. **Clean up duplicate components** - Consolidate ui/ duplicates
12. **Remove ComponentShowcase from prod** - Dev tool only
