import { invokeLLM } from '../../_core/llm';

export type AgentType = 'scout' | 'scorer' | 'strategist' | 'executor';

export interface AgentInput {
  accountId?: string;
  contactId?: string;
  data?: Record<string, any>;
  scoutReports?: AgentOutput[];
  scores?: AgentOutput[];
  strategies?: AgentOutput[];
}

export interface AgentOutput {
  type: string;
  data: Record<string, any>;
  confidence: number;
  reasoning: string;
}

export interface AgentLogEntry {
  timestamp: Date;
  agentId: string;
  actionType: string;
  input: AgentInput;
  output: AgentOutput;
  reasoning: string;
  confidence: number;
  dependencies: string[];
  executionTime?: number;
  tokensUsed?: number;
  costEstimate?: number;
}

/**
 * Base class for all agents in the AI-as-OS system.
 * 
 * Every agent:
 * - Reads from persistent storage (queryable organization)
 * - Executes its logic
 * - Logs its decision with full reasoning
 * - Feeds back into closed loops
 * 
 * No agent modifies data in-place. All modifications are appends or new versions.
 */
export abstract class Agent {
  id: string;
  type: AgentType;
  name: string;
  description: string;

  constructor(id: string, type: AgentType, name: string, description: string) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.description = description;
  }

  /**
   * Execute the agent's logic.
   * Must be implemented by subclasses.
   */
  abstract execute(input: AgentInput): Promise<AgentOutput>;

  /**
   * Log the agent's decision with full reasoning.
   * This creates an immutable audit trail.
   */
  protected async logDecision(
    input: AgentInput,
    output: AgentOutput,
    reasoning: string,
    confidence: number,
    executionTime?: number,
    tokensUsed?: number
  ): Promise<void> {
    const entry: AgentLogEntry = {
      timestamp: new Date(),
      agentId: this.id,
      actionType: this.type,
      input,
      output,
      reasoning,
      confidence,
      dependencies: [],
      executionTime,
      tokensUsed,
      costEstimate: tokensUsed ? tokensUsed * 0.00002 : undefined // Rough estimate
    };

    // Store in database
    // await drizzleDb.agentLogs.create(entry);

    // Make queryable
    await this.indexLog(entry);
  }

  /**
   * Query the organization for context.
   * This allows agents to understand the current state and history.
   */
  protected async queryOrganization(query: string): Promise<any> {
    // Query interface for agents to understand company state
    // Examples:
    // "Get account Acme Corp with all recent signals"
    // "Get contact John Smith with engagement history"
    // "Get all emails sent to Acme Corp in last 30 days"

    // TODO: Implement queryable organization interface
    // const result = await drizzleDb.query.raw(query);
    return {};
  }

  /**
   * Get account context for decision making.
   */
  protected async getAccountContext(accountId: string): Promise<any> {
    // TODO: Implement account context retrieval
    return {
      account: { id: accountId },
      contacts: [],
      actions: [],
      outcomes: [],
      logs: [],
      summary: {
        totalContacts: 0,
        totalActions: 0,
        successRate: 0,
        lastActivity: null
      }
    };
  }

  /**
   * Get contact context for decision making.
   */
  protected async getContactContext(contactId: string): Promise<any> {
    // TODO: Implement contact context retrieval
    return {
      contact: { id: contactId },
      account: {},
      actions: [],
      outcomes: [],
      logs: [],
      summary: {
        totalActions: 0,
        successRate: 0,
        lastActivity: null,
        engagement: 0
      }
    };
  }

  /**
   * Invoke Claude for complex decision making.
   * Agents can use Claude to analyze context and make decisions.
   */
  protected async invokeClaudeForDecision(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const content = response.choices[0].message.content;
    return typeof content === 'string' ? content : JSON.stringify(content);
  }

  /**
   * Create an action for the action queue.
   * Actions are immutable once created.
   */
  protected async createAction(
    type: string,
    accountId: string,
    contactId: string | null,
    content: any,
    reasoning: string,
    confidence: number
  ): Promise<string> {
    const action = {
      type,
      accountId,
      contactId,
      content,
      reasoning,
      confidence,
      status: 'pending',
      createdAt: new Date(),
      createdBy: this.id,
      dependencies: []
    };

    // TODO: Implement action creation
    // const result = await drizzleDb.actions.create(action);
    return 'action_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Private helper methods
   */
  private calculateSuccessRate(outcomes: any[]): number {
    if (outcomes.length === 0) return 0;

    const successful = outcomes.filter(o => o.success || o.type === 'meeting').length;
    return successful / outcomes.length;
  }

  private getLastActivity(logs: any[]): Date | null {
    if (logs.length === 0) return null;
    return logs[logs.length - 1].timestamp;
  }

  private calculateEngagement(outcomes: any[]): number {
    // Simple engagement score based on outcomes
    let score = 0;
    for (const outcome of outcomes) {
      if (outcome.type === 'email_opened') score += 10;
      if (outcome.type === 'email_clicked') score += 20;
      if (outcome.type === 'email_replied') score += 50;
      if (outcome.type === 'meeting') score += 100;
    }
    return score;
  }

  private async indexLog(entry: AgentLogEntry): Promise<void> {
    // Index for full-text search and querying
    // This makes agent logs queryable by future agents
    // TODO: Implement search indexing
    // await drizzleDb.search.index({...});
  }
}
