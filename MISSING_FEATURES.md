# Missing Features from Original Site

## Critical Missing Features

### 1. Executive Summary (Account Detail Page)
- **Status**: Shows skeleton loading, no actual AI-generated content
- **Original**: AI-generated executive summary with company insights
- **Action**: Connect to LLM API and generate real summaries

### 2. Company Logos
- **Status**: Many accounts show "LinkedIn" text instead of actual logos
- **Original**: Proper company logos/icons displayed
- **Action**: Implement logo fetching or use placeholder icons

### 3. Data Quality Issues
- **Status**: Many accounts have "Unknown" industry and "0" intent scores
- **Original**: Rich, complete data for all accounts
- **Action**: Enrich data from 6sense API or CSV imports

## Design & UI Missing Elements

### Homepage/Dashboard
- [ ] Priority Actions cards with proper styling (flame, lightning, link icons)
- [ ] Action buttons with different colored backgrounds per priority
- [ ] This Week's Focus checklist section
- [ ] Quick Actions section
- [ ] AI Assistant floating button (purple, bottom right)

### Accounts List Page
- [ ] Page header icon (purple database/layers icon)
- [ ] Account count display "756 of [redacted] accounts"
- [ ] 3-column grid layout (currently using different layout)
- [ ] Dashed borders on account cards
- [ ] Flame icons (red circles) for hot accounts
- [ ] Intent badges (purple pills "98 Hot")
- [ ] Icons in account details (briefcase, users, map-pin)

### Account Detail Page
- [ ] Company logo/icon (large colored square)
- [ ] Intent badge in header (purple pill)
- [ ] Company info row with proper icons (globe, briefcase, users, map-pin)
- [ ] "Generate Outreach" button (purple, top right)
- [ ] Technology Stack section with "Analyze Tech Stack with AI" button
- [ ] Contacts tab: 3-column grid with dashed borders, purple avatars
- [ ] Research tab: AI Research Synthesis with cyan border
- [ ] AI Insights tab: Strategic Recommendations with purple border

### Calls/Gong Calls Page
- [ ] Page header icon (cyan phone icon)
- [ ] Colored borders on stat cards (cyan, blue, purple)
- [ ] Icons on stat cards (phone, clock, building)
- [ ] Company filter dropdown
- [ ] Sort buttons (Date, Duration, Company) with active states
- [ ] Call cards with: duration, participant info, transcript preview, play button, tags/topics

### Insights/Data Analytics Studio Page
- [ ] **ENTIRE PAGE MISSING** - needs to be built from scratch
- [ ] Title "Data Analytics Studio"
- [ ] Tabs navigation (Overview, Chart Builder, Custom Dashboards)
- [ ] 4 stat cards with colored borders
- [ ] Intent Score Distribution chart (interactive, dashed border)
- [ ] Top Industries chart (clickable bars, cyan)
- [ ] Geographic Distribution chart (clickable bars, pink/magenta)
- [ ] Chart interactivity (click to filter, update other charts)

### Outreach Page
- [x] Two-column layout ✅
- [x] Step 1: Select Target Accounts with checkboxes ✅
- [x] Step 2: Select Contacts with checkboxes ✅
- [x] Step 3: Add Context textarea ✅
- [x] Generate button ✅
- [ ] Proper styling with dashed borders
- [ ] Cyan/purple icons
- [ ] Better visual hierarchy

## Functionality Missing

### AI Features
- [ ] Executive Summary generation (skeleton only, no content)
- [ ] AI Research Synthesis generation
- [ ] AI Strategic Recommendations generation
- [ ] Tech Stack Analysis with AI
- [ ] AI Assistant chatbot (button exists but not functional)

### Search & Filtering
- [ ] Global search (⌘K command palette)
- [ ] Advanced filtering on Accounts page (multi-select dropdowns)
- [ ] Working filters on Calls page
- [ ] Real-time search with highlighting

### Data & Integrations
- [ ] 6sense integration for real-time intent score updates
- [ ] Gong integration for call recordings/transcripts
- [ ] Clay integration for data enrichment
- [ ] Zapier integration for automation

### Other Features
- [ ] Contact export to CSV
- [ ] Bulk operations on contacts/accounts
- [ ] Task management system
- [ ] Notification system
- [ ] User preferences/settings

## TypeScript Errors to Fix
- 134 remaining compilation errors
- Main issues:
  - `.employees` → `.employeeCount` (20+ occurrences)
  - `call.participants` and `call.summary` references (fields don't exist)
  - Type mismatches (null vs undefined, number vs string)
  - Admin.tsx router references
  - AccountDetail component errors

## Summary

**Completion Status**: ~40% of original site features implemented

**High Priority Missing**:
1. Insights/Data Analytics Studio page (0% complete)
2. Executive Summary AI generation
3. Account Detail page visual polish
4. Company logos and data quality
5. TypeScript error fixes

**Medium Priority Missing**:
1. Calls page improvements
2. Advanced filtering and search
3. AI features (Research, Insights, Tech Stack)
4. Integrations (6sense, Gong, Clay)

**Low Priority Missing**:
1. AI Assistant chatbot
2. Task management
3. Bulk operations
4. Export functionality
