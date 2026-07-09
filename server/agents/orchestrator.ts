import { agentRegistry } from './core/agent-registry';
import { Agent, AgentInput, AgentOutput } from './core/agent-base';

/**
 * Agent Orchestrator
 * 
 * Coordinates the execution of all agents in the system.
 * Runs the full cycle: Scout → Scorer → Strategist → Executor
 * 
 * This is the heart of the AI-as-OS system.
 */
export class AgentOrchestrator {
  /**
   * Run the full agent cycle for an account.
   * 
   * 1. Scout Phase: Gather intelligence from external sources
   * 2. Scorer Phase: Analyze and rank opportunities
   * 3. Strategist Phase: Plan personalized outreach
   * 4. Executor Phase: Create actions for execution
   */
  async runFullCycle(accountId: string): Promise<{
    scoutReports: AgentOutput[];
    scores: AgentOutput[];
    strategies: AgentOutput[];
    actions: AgentOutput[];
  }> {
    console.log(`\n🚀 Starting full cycle for account: ${accountId}`);
    const startTime = Date.now();

    try {
      // Phase 1: Scout
      console.log(`\n📡 Phase 1: Scout - Gathering intelligence`);
      const scoutReports = await this.runPhase('scout', { accountId });

      // Phase 2: Scorer
      console.log(`\n📊 Phase 2: Scorer - Analyzing opportunities`);
      const scores = await this.runPhase('scorer', {
        accountId,
        scoutReports
      });

      // Phase 3: Strategist
      console.log(`\n🎯 Phase 3: Strategist - Planning outreach`);
      const strategies = await this.runPhase('strategist', {
        accountId,
        scores
      });

      // Phase 4: Executor
      console.log(`\n✉️  Phase 4: Executor - Creating actions`);
      const actions = await this.runPhase('executor', {
        accountId,
        strategies
      });

      const duration = Date.now() - startTime;
      console.log(`\n✅ Full cycle complete in ${duration}ms`);

      return {
        scoutReports,
        scores,
        strategies,
        actions
      };
    } catch (error: any) {
      console.error(`❌ Full cycle failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run a specific phase of the agent cycle.
   */
  private async runPhase(
    type: 'scout' | 'scorer' | 'strategist' | 'executor',
    input: AgentInput
  ): Promise<AgentOutput[]> {
    const agents = agentRegistry.getAgentsByType(type);
    const outputs: AgentOutput[] = [];

    console.log(`   Running ${agents.length} ${type} agent(s)`);

    for (const agent of agents) {
      try {
        const startTime = Date.now();
        const output = await agent.execute(input);
        const duration = Date.now() - startTime;

        console.log(
          `   ✓ ${agent.name}: confidence ${output.confidence}% (${duration}ms)`
        );

        outputs.push(output);
      } catch (error: any) {
        console.error(`   ✗ ${agent.name}: ${error.message}`);
        // Continue with other agents even if one fails
      }
    }

    return outputs;
  }

  /**
   * Run scouts only (for real-time intelligence gathering).
   */
  async runScouts(accountId: string): Promise<AgentOutput[]> {
    return this.runPhase('scout', { accountId });
  }

  /**
   * Run scorers only (for re-scoring existing data).
   */
  async runScorers(accountId: string, scoutReports?: AgentOutput[]): Promise<AgentOutput[]> {
    return this.runPhase('scorer', { accountId, scoutReports });
  }

  /**
   * Run strategists only (for re-planning outreach).
   */
  async runStrategists(accountId: string, scores?: AgentOutput[]): Promise<AgentOutput[]> {
    return this.runPhase('strategist', { accountId, scores });
  }

  /**
   * Run executors only (for creating new actions).
   */
  async runExecutors(accountId: string, strategies?: AgentOutput[]): Promise<AgentOutput[]> {
    return this.runPhase('executor', { accountId, strategies });
  }

  /**
   * Run continuous cycles for all accounts.
   * This is the main loop that keeps the system running 24/7.
   */
  async runContinuousCycles(
    accountIds: string[],
    intervalMs: number = 3600000 // 1 hour
  ): Promise<void> {
    console.log(`\n🔄 Starting continuous cycles for ${accountIds.length} accounts`);
    console.log(`   Interval: ${intervalMs}ms (${intervalMs / 1000 / 60} minutes)`);

    setInterval(async () => {
      for (const accountId of accountIds) {
        try {
          await this.runFullCycle(accountId);
        } catch (error: any) {
          console.error(`Error in continuous cycle for ${accountId}: ${error.message}`);
        }
      }
    }, intervalMs);
  }

  /**
   * Get orchestrator status.
   */
  getStatus(): {
    agents: ReturnType<typeof agentRegistry.getStatus>;
    timestamp: Date;
  } {
    return {
      agents: agentRegistry.getStatus(),
      timestamp: new Date()
    };
  }
}

// Global orchestrator instance
export const orchestrator = new AgentOrchestrator();
