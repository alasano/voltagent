import type { LocalAgentRegistry, AgentHistoryEntry } from "@voltagent/core";
import { AgentEventEmitter } from "@voltagent/core";

/**
 * WebSocket connection manager for agent-specific connections
 */
export class WebSocketConnectionManager {
  private connections = new Map<string, Set<any>>();
  private eventEmitter: AgentEventEmitter;

  constructor(private registry: LocalAgentRegistry) {
    this.eventEmitter = AgentEventEmitter.getInstance();
    this.setupEventSubscriptions();
  }

  /**
   * Add a WebSocket connection for a specific agent
   */
  addConnection(agentId: string, connection: any): void {
    if (!this.connections.has(agentId)) {
      this.connections.set(agentId, new Set());
    }
    this.connections.get(agentId)?.add(connection);
  }

  /**
   * Remove a WebSocket connection for a specific agent
   */
  removeConnection(agentId: string, connection: any): void {
    const agentConnections = this.connections.get(agentId);
    if (agentConnections) {
      agentConnections.delete(connection);
      if (agentConnections.size === 0) {
        this.connections.delete(agentId);
      }
    }
  }

  /**
   * Broadcast message to all connections for a specific agent
   */
  broadcastToAgent(agentId: string, message: any): void {
    const connections = this.connections.get(agentId);
    if (!connections) return;

    const messageStr = JSON.stringify(message);
    connections.forEach((ws) => {
      if (ws.readyState === 1) {
        // WebSocket.OPEN
        try {
          ws.send(messageStr);
        } catch (error) {
          console.error(`Failed to send message to WebSocket for agent ${agentId}:`, error);
          // Remove failed connection
          this.removeConnection(agentId, ws);
        }
      }
    });
  }

  /**
   * Get initial state for an agent when WebSocket connects
   */
  async getInitialAgentState(agentId: string): Promise<any> {
    const agent = this.registry.getAgent(agentId);
    if (!agent) return null;

    try {
      const history = await agent.getHistory();
      if (history && history.length > 0) {
        return {
          type: "HISTORY_LIST",
          success: true,
          data: history,
        };
      }
    } catch (error) {
      console.error(`Error loading history for agent ${agentId}:`, error);
    }

    return null;
  }

  /**
   * Set up event subscriptions for real-time updates
   */
  private setupEventSubscriptions(): void {
    // Subscribe to history updates
    this.eventEmitter.onHistoryUpdate((agentId: string, historyEntry: AgentHistoryEntry) => {
      // Extract the sequence number added by the emitter
      const sequenceNumber = (historyEntry as any)._sequenceNumber || Date.now();

      const message = {
        type: "HISTORY_UPDATE",
        success: true,
        sequenceNumber,
        data: historyEntry,
      };

      this.broadcastToAgent(agentId, message);
    });

    // Subscribe to new history entry created events
    this.eventEmitter.onHistoryEntryCreated((agentId: string, historyEntry: AgentHistoryEntry) => {
      const message = {
        type: "HISTORY_CREATED",
        success: true,
        data: historyEntry,
      };

      this.broadcastToAgent(agentId, message);
    });
  }

  /**
   * Handle general WebSocket test connection
   */
  handleTestConnection(connection: any): void {
    try {
      connection.send(
        JSON.stringify({
          type: "CONNECTION_TEST",
          success: true,
          data: {
            message: "WebSocket test connection successful",
            timestamp: new Date().toISOString(),
          },
        }),
      );
    } catch (error) {
      console.error("Failed to send test connection message:", error);
    }
  }

  /**
   * Handle echo messages for WebSocket testing
   */
  handleEchoMessage(connection: any, message: any): void {
    try {
      const data = typeof message === "string" ? JSON.parse(message) : message;
      connection.send(
        JSON.stringify({
          type: "ECHO",
          success: true,
          data,
        }),
      );
    } catch (error) {
      console.error("Failed to handle echo message:", error);
    }
  }

  /**
   * Get connection count for debugging
   */
  getConnectionStats(): { totalConnections: number; agentCount: number } {
    let totalConnections = 0;
    this.connections.forEach((connections) => {
      totalConnections += connections.size;
    });

    return {
      totalConnections,
      agentCount: this.connections.size,
    };
  }
}
