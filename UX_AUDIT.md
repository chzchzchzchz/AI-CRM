# UX Audit - Target Account Dashboard

## Critical Issues

### Outreach Page
1. **Multi-select allowed but shouldn't be** - Can select multiple accounts/contacts but email generation only works for 1:1
2. **Contact selection doesn't filter accounts** - If you select a contact first, their company should auto-select
3. **Account list not sorted by intent** - Shows random accounts first (CHECK, #N/A, Unknown) instead of hot leads
4. **No history of generated emails** - Once you leave the page, generated content is lost
5. **722 contacts shown with no account selected** - Should show 0 contacts until account is selected
6. **"CHECK", "#N/A", "Unknown" showing as account names** - Data quality issue, these should be filtered out or flagged

### Home Page
1. **Demo/WIP banner still showing** - Should be removable or hidden for production
2. **Priority Actions not clickable** - "View Full Account" buttons work but the cards themselves should be clickable
3. **This Week's Focus tasks are static** - Checkboxes don't persist, no way to add custom tasks
4. **Quick Actions limited** - Only 3 actions shown, could have more useful shortcuts

### Accounts Page
1. **"MATCH" showing as industry** - Many accounts show "MATCH" instead of actual industry
2. **No bulk actions** - Can't select multiple accounts for bulk operations
3. **Competitor filter works but no visual indicator** - Hard to tell what filter is active
4. **View Details button redundant** - Entire card is clickable, button is unnecessary

### Contacts Page
(Need to audit)

### Calls Page
(Need to audit)

### Insights Page
(Need to audit)

### AI Assistant
1. **No chat history** - Previous conversations are lost
2. **No memory of user preferences** - Doesn't remember what accounts user cares about
3. **No way to save/bookmark insights** - Good insights disappear after closing

## Data Quality Issues
1. **"MATCH" appearing as industry** - Should show actual industry or "Unknown"
2. **"CHECK" appearing as account name** - Invalid data showing in lists
3. **"#N/A" appearing as account name** - Spreadsheet errors leaked into data
4. **Missing employee counts** - Some accounts show no employee count
5. **Duplicate accounts** - Some companies appear multiple times (e.g., Ultimate Software/UKG)

## Missing Features
1. **User history/memory** - No storage of past generated content
2. **Saved searches/filters** - Can't save filter combinations
3. **Export functionality** - Can't export account lists or generated content
4. **Notification preferences** - No way to set up alerts for intent spikes
5. **Team collaboration** - No way to share accounts or insights with team members

## Priority Fixes (in order)
1. Fix Outreach page - single selection, auto-filter contacts by account
2. Sort accounts by intent score by default
3. Filter out invalid data (CHECK, #N/A, Unknown accounts)
4. Add email/chat history storage
5. Remove or hide Demo/WIP banner
