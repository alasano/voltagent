import type { Agent, AgentHistoryEntry } from "@voltagent/core";
import type { ConsoleAgentSummary, ConsoleAgentDetail, ConsoleHistoryEntry } from "../types";

/**
 * Formats agent data for console consumption
 * Ensures compatibility with console.voltagent.dev
 */
export class ConsoleDataFormatter {
  /**
   * Format a list of agents for the console agents endpoint
   */
  formatAgentList(agents: Agent<any>[]): ConsoleAgentSummary[] {
    return agents.map((agent) => this.formatAgentSummary(agent));
  }

  /**
   * Format a single agent summary
   */
  formatAgentSummary(agent: Agent<any>): ConsoleAgentSummary {
    const fullState = agent.getFullState();
    return {
      id: fullState.id,
      name: fullState.name,
      description: fullState.description,
      status: fullState.status,
      model: fullState.model,
      tools: agent.getToolsForApi(),
      subAgents:
        fullState.subAgents?.map((subAgent: any) => ({
          id: subAgent.id || "",
          name: subAgent.name || "",
          description: subAgent.description || "",
          status: subAgent.status || "idle",
          model: subAgent.model || "",
          tools: subAgent.tools || [],
          memory: subAgent.memory,
          isTelemetryEnabled: false,
        })) || [],
      memory: fullState.memory,
      isTelemetryEnabled: agent.isTelemetryConfigured(),
    };
  }

  /**
   * Format detailed agent information
   */
  formatAgentDetail(agent: Agent<any>): ConsoleAgentDetail {
    const fullState = agent.getFullState();
    return {
      id: fullState.id,
      name: fullState.name,
      description: fullState.description,
      instructions: fullState.instructions || fullState.description,
      status: fullState.status,
      model: fullState.model,
      tools: agent.getToolsForApi(),
      subAgents: fullState.subAgents || [],
      memory: fullState.memory,
      retriever: fullState.retriever,
      isTelemetryEnabled: agent.isTelemetryConfigured(),
      node_id: fullState.node_id,
    };
  }

  /**
   * Format agent history for console consumption
   */
  formatHistory(history: AgentHistoryEntry[]): ConsoleHistoryEntry[] {
    return history.map((entry) => ({
      id: entry.id,
      input: entry.input,
      output: entry.output,
      status: entry.status,
      startTime: entry.startTime,
      endTime: entry.endTime,
      steps: entry.steps || [],
      usage: entry.usage,
    }));
  }

  /**
   * Format a single history entry
   */
  formatHistoryEntry(entry: AgentHistoryEntry): ConsoleHistoryEntry {
    return {
      id: entry.id,
      input: entry.input,
      output: entry.output,
      status: entry.status,
      startTime: entry.startTime,
      endTime: entry.endTime,
      steps: entry.steps || [],
      usage: entry.usage,
    };
  }

  /**
   * Format success response
   */
  formatSuccess<T>(data: T) {
    return {
      success: true,
      data,
    };
  }

  /**
   * Format error response
   */
  formatError(error: string) {
    return {
      success: false,
      error,
    };
  }
}
