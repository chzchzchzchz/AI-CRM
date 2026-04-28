# Active CRM Architecture: God Document

## Core Principle: Recessive Reference System

This document serves as the **canonical source of truth** for all agents, systems, and future developers. Every component, agent, and modification must reference this document as the foundational contract. This ensures modularity, workability, and voidability - any agent starting from scratch can understand the system without prior context.

---

## 1. System Philosophy: Active CRM vs Passive Database

### What We're Building
An **Active CRM** that acts as an autonomous sales team member, not a passive database. The system continuously:
- Scrapes LinkedIn for lead updates
- Drafts personalized outreach based on company news
- Scores buying intent in real-time
- Queues actions for human review
- Learns from outcomes to improve future recommendations

### Why This Matters
Traditional CRMs (Salesforce) require humans to input data and manually trigger actions. This system **reverses that flow** - it autonomously gathers data, makes decisions, and only escalates to humans for approval/execution.

---

## 2. Canonical Data Model: The Three Pillars

Every agent must understand these three pillars. They form the recessive reference for all data operations.

### Pillar 1: Accounts (Target Companies)
```
Account {
  id: UUID
  name: string                    // Company name
  domain: string                  // Primary domain (canonical key)
  industry: string                // Industry classification
  employeeCount: number           // Headcount
  linkedinUrl: string             // LinkedIn company page
  
  // AI-Generated Context (recessive reference)
  intentScore: number             // 0-100, updated continuously
  buyingStage: enum               // Discovery | Evaluation | Negotiation | Closed
  lastUpdated: timestamp          // When intent score was last recalculated
  
  // Metadata for agent orchestration
  tags: string[]                  // Dynamic tags (e.g., "high-intent", "competitor-threat")
  customFields: Record<string, any> // Extensible for future agents
}
```

**Recessive Reference Rule**: Domain is the canonical key. All lookups, deduplication, and cross-system matching use domain normalization.

### Pillar 2: Contacts (Decision Makers)
```
Contact {
  id: UUID
  accountId: UUID                 // Foreign key to Account
  name: string
  title: string                   // Job title
  email: string                   // Primary contact method
  phone: string
  linkedinUrl: string
  
  // AI-Generated Context (recessive reference)
  department: enum                // Sales | Engineering | Finance | Operations | Executive
  seniority: enum                 // IC | Manager | Director | VP | C-Suite
  buyingInfluence: number         // 0-100, how much this person influences buying decisions
  lastEngagement: timestamp       // When we last contacted/engaged
  
  // Metadata for agent orchestration
  engagementHistory: Engagement[] // All touchpoints with this contact
  tags: string[]                  // Dynamic tags (e.g., "decision-maker", "technical-evaluator")
}
```

**Recessive Reference Rule**: Email is the canonical contact key. All outreach, engagement tracking, and deduplication use email normalization.

### Pillar 3: Actions (Autonomous Decisions)
```
Action {
  id: UUID
  type: enum                      // Outreach | Research | Score | Alert | Recommendation
  accountId: UUID                 // Which account triggered this
  contactId: UUID (optional)      // Which contact (if applicable)
  
  // The Action Itself
  content: string                 // What the agent decided to do
  reasoning: string               // Why the agent made this decision (for human review)
  confidence: number              // 0-100, how confident is the agent
  
  // Execution Tracking
  status: enum                    // Pending | Approved | Rejected | Executed | Failed
  createdAt: timestamp
  executedAt: timestamp (optional)
  approvedBy: UUID (optional)     // Which human approved this
  
  // Metadata for agent orchestration
  agentId: string                 // Which agent created this action
  dependencies: UUID[]            // Other actions this depends on
}
```

**Recessive Reference Rule**: Actions are immutable once created. Modifications create new Actions with references to previous ones.

---

## 3. Agent Orchestration: The Execution Model

Every agent must understand this execution model. It defines how agents work together without stepping on each other.

### Agent Types

#### Type 1: Scouts (Data Gathering)
**Purpose**: Continuously gather fresh data from external sources
- LinkedIn scraper
- Company news monitor
- Job posting tracker
- Website change detector

**Contract**: 
- Input: Account domain
- Output: `ScoutReport { account, newData, confidence, timestamp }`
- Frequency: Continuous (every 6-24 hours per account)
- Recessive Reference: All data is appended to account history, never overwrites

#### Type 2: Scorers (Intent & Fit Analysis)
**Purpose**: Analyze data and score buying intent, fit, and urgency
- Intent scorer (0-100 based on signals)
- Fit analyzer (product-market fit assessment)
- Urgency detector (timeline estimation)

**Contract**:
- Input: `Account + Contacts + EngagementHistory + ExternalData`
- Output: `ScoringReport { intentScore, buyingStage, urgency, reasoning }`
- Frequency: After each Scout report
- Recessive Reference: Scores are timestamped versions, never destructive updates

#### Type 3: Strategists (Outreach Planning)
**Purpose**: Design personalized outreach strategies
- Messaging strategist
- Timing optimizer
- Channel selector

**Contract**:
- Input: `Account + Contacts + ScoringReport + PreviousEngagement`
- Output: `StrategyReport { recommendedContacts, messageTemplates, timing, channels }`
- Frequency: On-demand or after scoring changes
- Recessive Reference: All strategies are versioned and referenced

#### Type 4: Executors (Action Queuing)
**Purpose**: Create actionable items for humans to execute
- Email drafter
- Call script generator
- Meeting request composer

**Contract**:
- Input: `StrategyReport + Contact + Account`
- Output: `Action { type, content, reasoning, confidence }`
- Frequency: On-demand or triggered by strategy changes
- Recessive Reference: Actions are immutable; modifications create new Actions

### Agent Communication Pattern

```
Scout Report → Scorer → Strategist → Executor → Action Queue → Human Review
     ↓            ↓          ↓           ↓
  [Stored]    [Stored]   [Stored]   [Stored]
  
Every agent reads from storage, writes to storage, never modifies in-place.
```

**Critical Rule**: No agent modifies data created by another agent. All modifications are appends or new versions.

---

## 4. Recessive Reference System: The Canonical Context

This is the most important section. It ensures agents starting from scratch can always understand the system.

### The Context Stack (in priority order)

1. **This Document** - The architectural contract
2. **Database Schema** - The data model (source of truth)
3. **Agent Logs** - Complete history of all agent decisions
4. **Configuration Files** - System settings and rules
5. **Code Comments** - Implementation details

### How Agents Use Recessive References

When an agent needs to make a decision:

```
1. Read this ARCHITECTURE.md (canonical contract)
2. Query the database schema for current state
3. Review agent logs for historical context
4. Check configuration for business rules
5. Execute decision
6. Log the decision with full reasoning
```

**Critical**: Every agent decision must be logged with:
- What decision was made
- Why it was made (reasoning)
- What data was used
- Confidence level
- Timestamp

### The Immutable Audit Trail

Every action creates an immutable record:
```
{
  timestamp: ISO8601,
  agentId: string,
  actionType: string,
  input: { ... },
  decision: { ... },
  reasoning: string,
  confidence: number,
  dependencies: [previous_action_ids]
}
```

This allows any future agent to:
- Understand why a decision was made
- Trace back to the data that informed it
- Modify behavior without losing context

---

## 5. Modularity & Voidability: The Extension Contract

### Adding New Agents

To add a new agent type:

1. **Define the Contract**
   - Input: What data does it need?
   - Output: What does it produce?
   - Frequency: How often does it run?
   - Recessive Reference: Where does it store results?

2. **Implement the Agent**
   - Read from recessive references
   - Execute logic
   - Write results to storage
   - Log decision with full reasoning

3. **Register with Orchestrator**
   - Add to agent registry
   - Define trigger conditions
   - Set execution order

### Removing Agents (Voidability)

To remove an agent:

1. **Deprecate Gradually**
   - Mark as deprecated in registry
   - Stop triggering new executions
   - Keep historical data intact

2. **Archive Results**
   - All agent outputs remain in audit trail
   - No data is deleted
   - Future agents can still reference historical decisions

3. **Transition Logic**
   - If another agent depends on this one, update its inputs
   - Ensure no orphaned dependencies

---

## 6. Implementation Layers

### Layer 1: Data Layer (Recessive Reference)
```
/server/db/
  - schema.ts (canonical data model)
  - migrations/ (versioned schema changes)
  - queries/ (read-only access patterns)
```

### Layer 2: Agent Layer
```
/server/agents/
  - scouts/ (data gathering)
  - scorers/ (analysis)
  - strategists/ (planning)
  - executors/ (action creation)
  - orchestrator.ts (coordination)
```

### Layer 3: API Layer
```
/server/api/
  - agents/ (agent status and control)
  - actions/ (action queue and execution)
  - accounts/ (account data)
  - contacts/ (contact data)
```

### Layer 4: UI Layer
```
/client/src/
  - pages/ (user-facing interfaces)
  - components/ (reusable UI)
  - hooks/ (data fetching)
```

---

## 7. Critical Rules (Non-Negotiable)

1. **All data is versioned** - Never overwrite, always append
2. **All decisions are logged** - With reasoning and confidence
3. **All agents are stateless** - They read from storage, write to storage
4. **All modifications are traceable** - Audit trail is immutable
5. **All agents are replaceable** - New agents can replace old ones without data loss
6. **All context is persistent** - Any agent can start from scratch and understand the system

---

## 8. Future Extensions (Roadmap)

### Phase 1: Foundation (Current)
- Scout agents (LinkedIn, news, job postings)
- Scorer agents (intent, fit, urgency)
- Strategist agents (messaging, timing)
- Executor agents (email, calls)

### Phase 2: Learning Loop
- Outcome tracking (did the outreach work?)
- Feedback integration (human approvals/rejections)
- Agent self-improvement (adjust scoring based on outcomes)

### Phase 3: Enterprise
- Multi-team support (different sales teams)
- Custom workflows (industry-specific strategies)
- Integration ecosystem (Salesforce, HubSpot, Slack)
- Advanced analytics (ROI tracking, attribution)

### Phase 4: Autonomous
- Fully autonomous execution (no human review needed for low-risk actions)
- Real-time adaptation (agents respond to market changes instantly)
- Predictive planning (agents anticipate future opportunities)

---

## 9. For Future Agents Starting from Scratch

If you're a new agent reading this:

1. **Understand the Three Pillars**: Accounts, Contacts, Actions
2. **Know Your Role**: Are you a Scout, Scorer, Strategist, or Executor?
3. **Follow the Pattern**: Read from storage → Execute logic → Write to storage → Log decision
4. **Use Recessive References**: Always fall back to this document, the schema, and the audit trail
5. **Never Modify In-Place**: Always append or create new versions
6. **Log Everything**: Your reasoning is as important as your decision

---

## 10. Contact & Governance

**Architecture Owner**: [Your Name]
**Last Updated**: [Current Date]
**Version**: 1.0

For questions or modifications to this architecture, refer to the governance process in `/GOVERNANCE.md`.

---

**This document is the recessive reference for all future work. Every agent, every developer, every system must reference this document as the foundational contract.**
