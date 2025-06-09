import type { Agent } from "../agent";
import { AgentEventEmitter } from "../events";
import type { VoltAgentExporter } from "../telemetry/exporter";

/**
 * Local registry to manage and track agents without server dependencies
 * This replaces the singleton AgentRegistry for server-independent usage
 */
export class LocalAgentRegistry {
  private agents: Map<string, Agent<any>> = new Map();
  private isInitialized = false;
  private globalVoltAgentExporter?: VoltAgentExporter;

  /**
   * Track parent-child relationships between agents (child -> parents)
   */
  private agentRelationships: Map<string, string[]> = new Map();

  constructor() {}

  /**
   * Initialize the registry
   */
  public initialize(): void {
    if (!this.isInitialized) {
      this.isInitialized = true;
    }
  }

  /**
   * Register a new agent
   */
  public registerAgent(agent: Agent<any>): void {
    if (!agent) {
      throw new Error("Agent cannot be null or undefined");
    }

    if (!agent.id || agent.id.trim() === "") {
      throw new Error("Agent must have a valid ID");
    }

    if (this.agents.has(agent.id)) {
      throw new Error(`Agent with ID '${agent.id}' is already registered`);
    }

    if (!this.isInitialized) {
      this.initialize();
    }
    this.agents.set(agent.id, agent);

    // Emit agent registered event for compatibility with original AgentRegistry
    AgentEventEmitter.getInstance().emitAgentRegistered(agent.id);
  }

  /**
   * Get an agent by ID
   */
  public getAgent(id: string): Agent<any> | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all registered agents
   */
  public getAllAgents(): Agent<any>[] {
    return Array.from(this.agents.values());
  }

  /**
   * Register a parent-child relationship between agents
   * @param parentId ID of the parent agent
   * @param childId ID of the child agent (sub-agent)
   */
  public registerSubAgent(parentId: string, childId: string): void {
    if (!this.agentRelationships.has(childId)) {
      this.agentRelationships.set(childId, []);
    }

    const parents = this.agentRelationships.get(childId) ?? [];
    if (!parents.includes(parentId)) {
      parents.push(parentId);
    }
  }

  /**
   * Remove a parent-child relationship
   * @param parentId ID of the parent agent
   * @param childId ID of the child agent
   */
  public unregisterSubAgent(parentId: string, childId: string): void {
    if (this.agentRelationships.has(childId)) {
      const parents = this.agentRelationships.get(childId) ?? [];
      const index = parents.indexOf(parentId);
      if (index !== -1) {
        parents.splice(index, 1);
      }

      // Remove the entry if there are no more parents
      if (parents.length === 0) {
        this.agentRelationships.delete(childId);
      }
    }
  }

  /**
   * Get all parent agent IDs for a given child agent
   * @param childId ID of the child agent
   * @returns Array of parent agent IDs
   */
  public getParentAgentIds(childId: string): string[] {
    return this.agentRelationships.get(childId) || [];
  }

  /**
   * Clear all parent-child relationships for an agent when it's removed
   * @param agentId ID of the agent being removed
   */
  public clearAgentRelationships(agentId: string): void {
    // Remove it as a child from any parents
    this.agentRelationships.delete(agentId);

    // Remove it as a parent from any children
    for (const [childId, parents] of this.agentRelationships.entries()) {
      const index = parents.indexOf(agentId);
      if (index !== -1) {
        parents.splice(index, 1);

        // Remove the entry if there are no more parents
        if (parents.length === 0) {
          this.agentRelationships.delete(childId);
        }
      }
    }
  }

  /**
   * Remove an agent by ID
   */
  public removeAgent(id: string): boolean {
    const result = this.agents.delete(id);
    if (result) {
      // Clear agent relationships
      this.clearAgentRelationships(id);

      // Emit agent unregistered event for compatibility with original AgentRegistry
      AgentEventEmitter.getInstance().emitAgentUnregistered(id);
    }
    return result;
  }

  /**
   * Get agent count
   */
  public getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Check if registry is initialized
   */
  public isRegistryInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Clear all agents from the registry
   */
  public clear(): void {
    this.agents.clear();
    this.agentRelationships.clear();
  }

  /**
   * Get all agent IDs
   */
  public getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Check if an agent is registered
   */
  public hasAgent(id: string): boolean {
    return this.agents.has(id);
  }

  /**
   * Set the global VoltAgentExporter instance.
   * This is typically called by the main VoltAgent instance.
   */
  public setGlobalVoltAgentExporter(exporter: VoltAgentExporter): void {
    this.globalVoltAgentExporter = exporter;
  }

  /**
   * Get the global VoltAgentExporter instance.
   */
  public getGlobalVoltAgentExporter(): VoltAgentExporter | undefined {
    return this.globalVoltAgentExporter;
  }
}
