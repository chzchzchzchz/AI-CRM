# Backend Redesign: AI-as-OS Architecture

This is not a documentation update. This is a complete backend redesign to make the AI-as-OS philosophy operational.

## Current State (Broken)
- Agents are stubs
- No closed loops
- No learning
- No autonomous execution
- Frontend-heavy, backend-light
- Database is just storage, not intelligence

## Target State (AI-as-OS)
- Agents are autonomous and orchestrated
- Closed loops feed outcomes back to improve decisions
- System learns from every interaction
- Autonomous execution with human approval gates
- Backend-heavy, frontend is just UI for backend decisions
- Database is the company brain

---

## Phase 1: Core Agent Orchestration Engine

### New File Structure
```
server/
├── agents/
│   ├── core/
│   │   ├── agent-base.ts          # Base class for all agents
│   │   ├── agent-registry.ts      # Agent discovery and management
│   │   ├── agent-executor.ts      # Execution engine
│   │   └── agent-context.ts       # Shared context for agents
│   ├── scouts/
│   │   ├── linkedin-scout.ts      # LinkedIn monitoring
│   │   ├── news-scout.ts          # Company news monitoring
│   │   ├── job-posting-scout.ts   # Job posting monitoring
│   │   └── website-scout.ts       # Website change detection
│   ├── scorers/
│   │   ├── intent-scorer.ts       # Intent scoring (0-100)
│   │   ├── fit-scorer.ts          # Product-market fit
│   │   └── urgency-scorer.ts      # Timeline estimation
│   ├── strategists/
│   │   ├── messaging-strategist.ts
│   │   ├── timing-strategist.ts
│   │   └── channel-strategist.ts
│   ├── executors/
│   │   ├── email-executor.ts
│   │   ├── call-executor.ts
│   │   └── linkedin-executor.ts
│   └── orchestrator.ts            # Main orchestration engine
├── loops/
│   ├── closed-loop-engine.ts      # Feedback loop management
│   ├── outcome-tracker.ts         # Track execution outcomes
│   └── learning-engine.ts         # Learn from outcomes
├── query/
│   ├── queryable-org.ts           # Query interface for organization
│   ├── artifact-store.ts          # Store all artifacts
│   └── context-builder.ts         # Build context for agents
├── execution/
│   ├── action-queue.ts            # Queue for pending actions
│   ├── approval-engine.ts         # Human approval workflow
│   └── autonomous-executor.ts     # Execute low-risk actions
└── logging/
    ├── agent-logger.ts            # Log all agent decisions
    ├── audit-trail.ts             # Immutable audit trail
    └── decision-tracker.ts        # Track decision history
```

### Agent Base Class
```typescript
// server/agents/core/agent-base.ts
abstract class Agent {
  id: string;
  type: 'scout' | 'scorer' | 'strategist' | 'executor';
  name: string;
  description: string;
  
  // Every agent must implement execute()
  abstract execute(input: AgentInput): Promise<AgentOutput>;
  
  // Every agent must log its decision
  protected async logDecision(
    input: AgentInput,
    output: AgentOutput,
    reasoning: string,
    confidence: number
  ): Promise<void> {
    await agentLogger.log({
      timestamp: new Date(),
      agentId: this.id,
      actionType: this.type,
      input,
      output,
      reasoning,
      confidence,
      dependencies: []
    });
  }
  
  // Every agent can query the organization
  protected async queryOrganization(query: string): Promise<any> {
    return queryableOrg.query(query);
  }
}
```

### Agent Registry
```typescript
// server/agents/core/agent-registry.ts
class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  
  register(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }
  
  getAgent(id: string): Agent {
    return this.agents.get(id);
  }
  
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
  
  getAgentsByType(type: string): Agent[] {
    return Array.from(this.agents.values())
      .filter(a => a.type === type);
  }
}
```

### Orchestrator
```typescript
// server/agents/orchestrator.ts
class AgentOrchestrator {
  private registry: AgentRegistry;
  private actionQueue: ActionQueue;
  private closedLoopEngine: ClosedLoopEngine;
  
  async runFullCycle(accountId: string): Promise<void> {
    // 1. Scout Phase: Gather intelligence
    const scoutReports = await this.runScouts(accountId);
    
    // 2. Scorer Phase: Analyze and rank
    const scores = await this.runScorers(accountId, scoutReports);
    
    // 3. Strategist Phase: Plan outreach
    const strategies = await this.runStrategists(accountId, scores);
    
    // 4. Executor Phase: Create actions
    const actions = await this.runExecutors(accountId, strategies);
    
    // 5. Queue Phase: Add to action queue
    for (const action of actions) {
      await this.actionQueue.enqueue(action);
    }
    
    // 6. Closed Loop: Set up feedback tracking
    for (const action of actions) {
      await this.closedLoopEngine.setupFeedback(action);
    }
  }
  
  private async runScouts(accountId: string): Promise<ScoutReport[]> {
    const scouts = this.registry.getAgentsByType('scout');
    const reports = [];
    
    for (const scout of scouts) {
      const report = await scout.execute({ accountId });
      reports.push(report);
    }
    
    return reports;
  }
  
  // Similar for runScorers, runStrategists, runExecutors
}
```

---

## Phase 2: Closed-Loop Feedback System

### Closed Loop Engine
```typescript
// server/loops/closed-loop-engine.ts
class ClosedLoopEngine {
  async setupFeedback(action: Action): Promise<void> {
    // Set up tracking for this action
    const tracker = {
      actionId: action.id,
      type: action.type,
      createdAt: new Date(),
      outcomes: [],
      feedbackCallbacks: []
    };
    
    // Register outcome handlers
    if (action.type === 'email') {
      tracker.feedbackCallbacks.push(
        async (outcome) => this.handleEmailOutcome(action, outcome)
      );
    }
    
    // Store tracker
    await outcomeTracker.store(tracker);
  }
  
  private async handleEmailOutcome(action: Action, outcome: EmailOutcome): Promise<void> {
    // Record outcome
    await outcomeTracker.recordOutcome(action.id, outcome);
    
    // Feed back to learning engine
    await learningEngine.learn({
      action,
      outcome,
      timestamp: new Date()
    });
    
    // Update agent scores
    await this.updateAgentScores(action, outcome);
  }
  
  private async updateAgentScores(action: Action, outcome: any): Promise<void> {
    // If email was opened, increase confidence in email executor
    if (outcome.opened) {
      await agentScoreCard.increment(
        'email_executor',
        'open_rate',
        1
      );
    }
    
    // If meeting was booked, increase confidence in strategist
    if (outcome.meetingBooked) {
      await agentScoreCard.increment(
        'messaging_strategist',
        'booking_rate',
        1
      );
    }
  }
}
```

### Learning Engine
```typescript
// server/loops/learning-engine.ts
class LearningEngine {
  async learn(feedback: LearningFeedback): Promise<void> {
    const { action, outcome, timestamp } = feedback;
    
    // Store the learning
    await learningStore.store({
      actionId: action.id,
      outcome,
      timestamp,
      agents: action.agentIds,
      reasoning: action.reasoning
    });
    
    // Update agent performance metrics
    for (const agentId of action.agentIds) {
      await this.updateAgentMetrics(agentId, outcome);
    }
    
    // Trigger agent retraining if needed
    if (this.shouldRetrain(action.type)) {
      await this.triggerRetraining(action.type);
    }
  }
  
  private async updateAgentMetrics(agentId: string, outcome: any): Promise<void> {
    const metrics = await agentMetrics.get(agentId);
    
    // Update success rate
    metrics.totalAttempts++;
    if (outcome.success) {
      metrics.successCount++;
    }
    
    // Update confidence
    metrics.confidence = metrics.successCount / metrics.totalAttempts;
    
    await agentMetrics.save(agentId, metrics);
  }
  
  private shouldRetrain(actionType: string): boolean {
    // Retrain if success rate drops below threshold
    return true; // Simplified
  }
  
  private async triggerRetraining(actionType: string): Promise<void> {
    // Trigger Claude to improve agent prompts based on failures
    const failures = await learningStore.getRecentFailures(actionType, 10);
    
    const improvementPrompt = `
      These recent ${actionType} actions failed. Analyze why and suggest improvements:
      ${JSON.stringify(failures)}
    `;
    
    const improvement = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are an agent improvement specialist.' },
        { role: 'user', content: improvementPrompt }
      ]
    });
    
    // Store improvement for next agent iteration
    await agentPromptStore.store(actionType, improvement);
  }
}
```

---

## Phase 3: Queryable Organization Layer

### Queryable Organization Interface
```typescript
// server/query/queryable-org.ts
class QueryableOrganization {
  async query(query: string): Promise<any> {
    // Parse the query
    const parsed = this.parseQuery(query);
    
    // Execute the query across all data sources
    const results = await this.executeQuery(parsed);
    
    // Return results with context
    return {
      results,
      context: await this.buildContext(results),
      timestamp: new Date()
    };
  }
  
  private parseQuery(query: string): ParsedQuery {
    // Examples:
    // "Show me all emails sent to Acme Corp in the last 30 days"
    // "What was the response rate for emails about promotions?"
    // "Which contacts have the highest buying influence?"
    
    return {
      type: this.detectQueryType(query),
      filters: this.extractFilters(query),
      timeRange: this.extractTimeRange(query)
    };
  }
  
  private async executeQuery(parsed: ParsedQuery): Promise<any> {
    switch (parsed.type) {
      case 'emails':
        return this.queryEmails(parsed.filters, parsed.timeRange);
      case 'contacts':
        return this.queryContacts(parsed.filters);
      case 'accounts':
        return this.queryAccounts(parsed.filters);
      case 'outcomes':
        return this.queryOutcomes(parsed.filters, parsed.timeRange);
      default:
        throw new Error(`Unknown query type: ${parsed.type}`);
    }
  }
  
  private async buildContext(results: any): Promise<any> {
    // For each result, build rich context
    return {
      summary: this.summarizeResults(results),
      patterns: this.identifyPatterns(results),
      recommendations: await this.generateRecommendations(results)
    };
  }
}
```

### Artifact Store
```typescript
// server/query/artifact-store.ts
class ArtifactStore {
  async storeArtifact(artifact: Artifact): Promise<void> {
    // Every artifact is immutable and queryable
    const stored = {
      id: generateId(),
      type: artifact.type,  // 'email', 'call', 'decision', 'outcome'
      content: artifact.content,
      metadata: artifact.metadata,
      createdAt: new Date(),
      createdBy: artifact.createdBy,  // Agent ID
      relatedTo: artifact.relatedTo,  // Account, Contact, Action IDs
      tags: artifact.tags
    };
    
    await db.artifacts.insert(stored);
    
    // Index for querying
    await searchIndex.index(stored);
  }
  
  async queryArtifacts(filters: ArtifactFilters): Promise<Artifact[]> {
    return await searchIndex.search(filters);
  }
  
  async getArtifactContext(artifactId: string): Promise<any> {
    const artifact = await db.artifacts.findById(artifactId);
    
    // Get all related artifacts
    const related = await db.artifacts.find({
      relatedTo: { $in: artifact.relatedTo }
    });
    
    return {
      artifact,
      related,
      timeline: this.buildTimeline(artifact, related)
    };
  }
}
```

---

## Phase 4: Agent Execution and Logging System

### Agent Logger
```typescript
// server/logging/agent-logger.ts
class AgentLogger {
  async log(entry: AgentLogEntry): Promise<void> {
    const logged = {
      id: generateId(),
      timestamp: entry.timestamp,
      agentId: entry.agentId,
      actionType: entry.actionType,
      
      // Input/Output
      input: entry.input,
      output: entry.output,
      
      // Decision Making
      reasoning: entry.reasoning,
      confidence: entry.confidence,
      dependencies: entry.dependencies,
      
      // Metadata
      executionTime: entry.executionTime,
      tokensUsed: entry.tokensUsed,
      costEstimate: entry.costEstimate
    };
    
    await db.agentLogs.insert(logged);
    
    // Make queryable
    await queryableOrg.indexLog(logged);
  }
  
  async getAgentHistory(agentId: string, limit: number = 100): Promise<AgentLogEntry[]> {
    return await db.agentLogs.find(
      { agentId },
      { sort: { timestamp: -1 }, limit }
    );
  }
  
  async getDecisionChain(actionId: string): Promise<AgentLogEntry[]> {
    // Get all agents that contributed to this action
    const action = await db.actions.findById(actionId);
    
    const logs = await db.agentLogs.find({
      dependencies: actionId
    });
    
    return logs;
  }
}
```

### Audit Trail
```typescript
// server/logging/audit-trail.ts
class AuditTrail {
  async recordDecision(decision: Decision): Promise<void> {
    // Every decision is immutable
    const entry = {
      id: generateId(),
      timestamp: new Date(),
      type: decision.type,
      actor: decision.actor,  // Agent or Human
      action: decision.action,
      reasoning: decision.reasoning,
      confidence: decision.confidence,
      outcome: null,  // Will be filled in later
      metadata: decision.metadata
    };
    
    await db.auditTrail.insert(entry);
  }
  
  async recordOutcome(decisionId: string, outcome: any): Promise<void> {
    // Link outcome to decision
    await db.auditTrail.updateById(decisionId, {
      outcome,
      outcomeRecordedAt: new Date()
    });
  }
  
  async getAuditTrail(filters: AuditFilters): Promise<AuditEntry[]> {
    return await db.auditTrail.find(filters);
  }
}
```

---

## Phase 5: Outcome Tracking and Learning Loops

### Outcome Tracker
```typescript
// server/loops/outcome-tracker.ts
class OutcomeTracker {
  async trackEmailOutcome(actionId: string, event: EmailEvent): Promise<void> {
    const action = await db.actions.findById(actionId);
    
    const outcome = {
      actionId,
      type: 'email',
      event: event.type,  // 'opened', 'clicked', 'replied', 'bounced'
      timestamp: new Date(),
      metadata: event.metadata
    };
    
    await db.outcomes.insert(outcome);
    
    // Trigger feedback loop
    await closedLoopEngine.handleOutcome(action, outcome);
  }
  
  async trackMeetingOutcome(actionId: string, meeting: Meeting): Promise<void> {
    const outcome = {
      actionId,
      type: 'meeting',
      booked: true,
      timestamp: new Date(),
      meetingId: meeting.id,
      metadata: {
        duration: meeting.duration,
        attendees: meeting.attendees,
        notes: meeting.notes
      }
    };
    
    await db.outcomes.insert(outcome);
    
    // Trigger feedback loop
    const action = await db.actions.findById(actionId);
    await closedLoopEngine.handleOutcome(action, outcome);
  }
  
  async getOutcomeMetrics(timeRange: TimeRange): Promise<Metrics> {
    const outcomes = await db.outcomes.find({
      timestamp: { $gte: timeRange.start, $lte: timeRange.end }
    });
    
    return {
      totalActions: outcomes.length,
      openRate: outcomes.filter(o => o.event === 'opened').length / outcomes.length,
      clickRate: outcomes.filter(o => o.event === 'clicked').length / outcomes.length,
      replyRate: outcomes.filter(o => o.event === 'replied').length / outcomes.length,
      meetingRate: outcomes.filter(o => o.type === 'meeting').length / outcomes.length,
      bounceRate: outcomes.filter(o => o.event === 'bounced').length / outcomes.length
    };
  }
}
```

---

## Phase 6: Autonomous Execution Framework

### Action Queue
```typescript
// server/execution/action-queue.ts
class ActionQueue {
  async enqueue(action: Action): Promise<void> {
    // Determine if action needs human approval
    const needsApproval = this.determineApprovalNeeded(action);
    
    const queued = {
      id: generateId(),
      action,
      status: needsApproval ? 'pending_approval' : 'pending_execution',
      createdAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      executedAt: null,
      outcome: null
    };
    
    await db.actionQueue.insert(queued);
  }
  
  private determineApprovalNeeded(action: Action): boolean {
    // Low-risk actions can execute autonomously
    const lowRiskTypes = [
      'email_to_known_contact',
      'linkedin_message_to_known_contact'
    ];
    
    if (lowRiskTypes.includes(action.type)) {
      return false;  // No approval needed
    }
    
    // High-risk actions need approval
    return true;
  }
  
  async getApprovalQueue(): Promise<Action[]> {
    return await db.actionQueue.find(
      { status: 'pending_approval' },
      { sort: { createdAt: 1 } }
    );
  }
  
  async approveAction(actionId: string, approvedBy: string): Promise<void> {
    await db.actionQueue.updateById(actionId, {
      status: 'pending_execution',
      approvedAt: new Date(),
      approvedBy
    });
  }
  
  async rejectAction(actionId: string, rejectedBy: string, reason: string): Promise<void> {
    await db.actionQueue.updateById(actionId, {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectedBy,
      rejectionReason: reason
    });
  }
}
```

### Autonomous Executor
```typescript
// server/execution/autonomous-executor.ts
class AutonomousExecutor {
  async executeQueue(): Promise<void> {
    // Run continuously
    setInterval(async () => {
      const pendingActions = await db.actionQueue.find(
        { status: 'pending_execution' }
      );
      
      for (const action of pendingActions) {
        await this.executeAction(action);
      }
    }, 60000);  // Every minute
  }
  
  private async executeAction(queuedAction: QueuedAction): Promise<void> {
    try {
      const action = queuedAction.action;
      
      // Execute based on type
      let result;
      switch (action.type) {
        case 'email':
          result = await this.sendEmail(action);
          break;
        case 'linkedin_message':
          result = await this.sendLinkedInMessage(action);
          break;
        case 'call':
          result = await this.initiateCall(action);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
      
      // Update queue
      await db.actionQueue.updateById(queuedAction.id, {
        status: 'executed',
        executedAt: new Date(),
        executionResult: result
      });
      
      // Track outcome
      await outcomeTracker.trackExecution(action, result);
      
    } catch (error) {
      await db.actionQueue.updateById(queuedAction.id, {
        status: 'failed',
        error: error.message
      });
    }
  }
  
  private async sendEmail(action: Action): Promise<any> {
    // Send email via email service
    const result = await emailService.send({
      to: action.contact.email,
      subject: action.content.subject,
      body: action.content.body
    });
    
    return result;
  }
}
```

---

## Implementation Priority

1. **Week 1**: Core agent orchestration engine + agent base class
2. **Week 2**: Closed-loop feedback system + learning engine
3. **Week 3**: Queryable organization layer + artifact store
4. **Week 4**: Agent execution and logging system
5. **Week 5**: Outcome tracking and autonomous execution
6. **Week 6**: Testing and optimization

---

## Success Metrics

- Agents execute autonomously 24/7
- Closed loops improve decision quality over time
- System learns from every interaction
- Queryable organization enables AI to understand company state
- Autonomous execution reduces human intervention by 80%
- Token usage optimized (cost per account decreases over time)

---

## This Is Not a Tool

This is an operating system. The backend is the company. The frontend is just the UI.
