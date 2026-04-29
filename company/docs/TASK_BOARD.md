# Task Board

## Backlog 📋
*Ideas and feature requests - not yet scoped*

| ID | Task | Department | Priority | Labels |
|----|------|------------|----------|--------|
| B001 | Add Salesforce API integration (OAuth2, REST API) | Engineering | High | api, integration, salesforce |
| B002 | Add LinkedIn API integration (profile scraping, company data) | Engineering | High | api, integration, linkedin |
| B003 | Add 6sense intent data integration | Engineering | Medium | api, integration, 6sense |
| B004 | Add Gong call recording integration | Engineering | Medium | api, integration, gong |
| B005 | Build MCP server for agent-first CRM | Engineering | High | mcp, agent-first |
| B006 | Create company hierarchy documentation | Product | High | docs, setup |
| B007 | Clean all {COMPANY_NAME} references from codebase | Product | High | cleanup, tech-debt |
| B008 | Build natural language UI (chat-based CRM) | Product/Design | Medium | ui, nlu, chat |
| B009 | Multi-tenant support (row-level security) | Engineering | High | multi-tenant, enterprise |
| B010 | Open-source core (MIT license) | Product | Medium | oss, licensing |

---

## Ready ✅  
*Scoped and ready to start*

| ID | Task | Department | Assigned To | Priority | 
|----|------|------------|-------------|----------|
| R001 | Set up Salesforce OAuth2 flow | Engineering (Backend Dev) | Unassigned | High |
| R002 | Set up LinkedIn API credentials + test | Engineering (Backend Dev) | Unassigned | High |
| R003 | Build API wrapper for Salesforce REST API | Engineering (Backend Dev) | Unassigned | High |
| R004 | Build API wrapper for LinkedIn v2 API | Engineering (Backend Dev) | Unassigned | High |
| R005 | Create integration docs for all APIs | Product (Data Analyst) | Unassigned | Medium |
| R006 | Set up company employee handbook | Product (Product Lead) | Unassigned | High |
| R007 | Create initial database schema for multi-tenant | Engineering (DB Architect) | Unassigned | High |

---

## In Progress 🚧
*Currently being worked on*

| ID | Task | Department | Assigned To | Started | 
|----|------|------------|-------------|---------|
| IP001 | *(no tasks in progress)* | - | - | - |

---

## Review 🔍
*Needs code review or QA*

| ID | Task | Department | Submitted By | Status |
|----|------|------------|-------------|--------|
| RV001 | *(no tasks in review)* | - | - |

---

## Done ✔️
*Shipped to production*

| ID | Task | Department | Completed | 
|----|------|------------|------------|
| D001 | Initial repo setup (AI-CRM from {COMPANY_NAME}) | Engineering | 2026-04-28 |
| D002 | Clean {COMPANY_NAME} files from Downloads | Product | 2026-04-28 |
| D003 | Create company hierarchy structure | Product | 2026-04-28 |
| D004 | Write employee handbook | Product | 2026-04-28 |

---

## Task Template
When adding a task, use this format:

```markdown
### [ID] Task Title
**Department**: Engineering / Product / Sales / Marketing / Support
**Assigned To**: Agent name (or "Unassigned")
**Priority**: High / Medium / Low
**Labels**: comma, separated, tags

**Description**:
What needs to be done.

**Acceptance Criteria**:
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

**Files Affected**:
- `path/to/file1.ts`
- `path/to/file2.ts`

**Dependencies**:
- Task B001 (must be done first)

**Estimated Effort**: 2-4 hours / 1-2 days / 3-5 days
```

---

## How to Pick Up a Task (For Agents)

1. **Find an unassigned task** in "Ready" column
2. **Assign it to yourself** (edit this file, change "Unassigned" to your agent name)
3. **Move it to "In Progress"** section
4. **Create a feature branch**: `git checkout -b feature/[task-id]-short-desc`
5. **Do the work**
6. **Submit for review**: Move to "Review" section, notify department Slack channel
7. **After approval**: Move to "Done", close the task

---

## Current Sprint (Week of 2026-04-28)

**Goal**: Get API integrations working so any company can import their data

**Tasks in Sprint**:
- [ ] R001: Salesforce OAuth2 setup
- [ ] R002: LinkedIn API setup  
- [ ] R003: Salesforce REST API wrapper
- [ ] R004: LinkedIn API wrapper
- [ ] R005: API integration docs

**Sprint End**: 2026-05-02
