import { Agent, AgentType } from './agent-base';

/**
 * Agent Registry
 * 
 * Central registry for all agents in the system.
 * Agents register themselves on startup.
 * Orchestrator queries registry to find agents by type or ID.
 */
export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private agentsByType: Map<AgentType, Agent[]> = new Map();

  constructor() {
    // Initialize type maps
    this.agentsByType.set('scout', []);
    this.agentsByType.set('scorer', []);
    this.agentsByType.set('strategist', []);
    this.agentsByType.set('executor', []);
  }

  /**
   * Register an agent in the system.
   */
  register(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent already registered: ${agent.id}`);
    }

    this.agents.set(agent.id, agent);
    
    const agentsOfType = this.agentsByType.get(agent.type) || [];
    agentsOfType.push(agent);
    this.agentsByType.set(agent.type, agentsOfType);

    console.log(`✓ Registered ${agent.type} agent: ${agent.name} (${agent.id})`);
  }

  /**
   * Get a specific agent by ID.
   */
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all agents.
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get all agents of a specific type.
   */
  getAgentsByType(type: AgentType): Agent[] {
    return this.agentsByType.get(type) || [];
  }

  /**
   * Get all scouts.
   */
  getScouts(): Agent[] {
    return this.getAgentsByType('scout');
  }

  /**
   * Get all scorers.
   */
  getScorers(): Agent[] {
    return this.getAgentsByType('scorer');
  }

  /**
   * Get all strategists.
   */
  getStrategists(): Agent[] {
    return this.getAgentsByType('strategist');
  }

  /**
   * Get all executors.
   */
  getExecutors(): Agent[] {
    return this.getAgentsByType('executor');
  }

  /**
   * Get registry status for debugging.
   */
  getStatus(): {
    totalAgents: number;
    scouts: number;
    scorers: number;
    strategists: number;
    executors: number;
    agents: Array<{ id: string; name: string; type: AgentType }>;
  } {
    return {
      totalAgents: this.agents.size,
      scouts: this.getScouts().length,
      scorers: this.getScorers().length,
      strategists: this.getStrategists().length,
      executors: this.getExecutors().length,
      agents: this.getAllAgents().map(a => ({
        id: a.id,
        name: a.name,
        type: a.type
      }))
    };
  }
}

// Global registry instance
export const agentRegistry = new AgentRegistry();
