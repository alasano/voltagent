import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { LocalAgentRegistry, AgentHistoryEntry } from "@voltagent/core";
import { AgentEventEmitter } from "@voltagent/core";

// Store WebSocket connections for each agent
const agentConnections = new Map<string, Set<WebSocket>>();

/**
 * Create WebSocket server for real-time agent communication
 */
export function createWebSocketServer(registry: LocalAgentRegistry): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  // Subscribe to agent events for real-time updates
  setupEventSubscriptions(registry);

  wss.on("connection", async (ws, req) => {
    // Extract agent ID from URL - /ws/agents/:id
    const url = new URL(req.url || "", "ws://localhost");
    const pathParts = url.pathname.split("/");

    if (url.pathname === "/ws") {
      // Test connection
      ws.send(
        JSON.stringify({
          type: "CONNECTION_TEST",
          success: true,
          data: {
            message: "WebSocket test connection successful",
            timestamp: new Date().toISOString(),
          },
        }),
      );

      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());
          ws.send(
            JSON.stringify({
              type: "ECHO",
              success: true,
              data,
            }),
          );
        } catch (error) {
          console.error("[WebSocket] Failed to parse message:", error);
        }
      });

      return;
    }

    // Agent-specific WebSocket: /ws/agents/:id
    const agentId = pathParts.length >= 4 ? decodeURIComponent(pathParts[3]) : null;

    if (!agentId) {
      ws.close();
      return;
    }

    // Add connection to the agent's connection set
    if (!agentConnections.has(agentId)) {
      agentConnections.set(agentId, new Set());
    }
    agentConnections.get(agentId)?.add(ws);

    // Get agent and send initial state
    const agent = registry.getAgent(agentId);
    if (agent) {
      try {
        // Get history
        const history = await agent.getHistory();

        if (history && history.length > 0) {
          // Send all history entries in one message
          ws.send(
            JSON.stringify({
              type: "HISTORY_LIST",
              success: true,
              data: history,
            }),
          );

          // Also check if there's an active history entry and send it individually
          const activeHistory = history.find(
            (entry: AgentHistoryEntry) => entry.status !== "completed" && entry.status !== "error",
          );

          if (activeHistory) {
            ws.send(
              JSON.stringify({
                type: "HISTORY_UPDATE",
                success: true,
                data: activeHistory,
              }),
            );
          }
        }
      } catch (error) {
        console.error(`[WebSocket] Error loading history for agent ${agentId}:`, error);
      }
    }

    ws.on("close", () => {
      // Remove connection from the agent's connection set
      agentConnections.get(agentId)?.delete(ws);
      if (agentConnections.get(agentId)?.size === 0) {
        agentConnections.delete(agentId);
      }
    });

    ws.on("error", (error) => {
      console.error("[WebSocket] Error:", error);
    });
  });

  return wss;
}

/**
 * Set up event subscriptions for the registry
 */
function setupEventSubscriptions(registry: LocalAgentRegistry): void {
  const eventEmitter = AgentEventEmitter.getInstance();

  // Subscribe to history updates
  eventEmitter.onHistoryUpdate((agentId: string, historyEntry: AgentHistoryEntry) => {
    const connections = agentConnections.get(agentId);
    if (!connections) return;

    // Extract the sequence number added by the emitter
    const sequenceNumber = (historyEntry as any)._sequenceNumber || Date.now();

    const message = JSON.stringify({
      type: "HISTORY_UPDATE",
      success: true,
      sequenceNumber,
      data: historyEntry,
    });

    connections.forEach((ws) => {
      if (ws.readyState === 1) {
        // WebSocket.OPEN
        ws.send(message);
      }
    });
  });

  // Subscribe to new history entry created events
  eventEmitter.onHistoryEntryCreated((agentId: string, historyEntry: AgentHistoryEntry) => {
    const connections = agentConnections.get(agentId);
    if (!connections) return;

    const message = JSON.stringify({
      type: "HISTORY_CREATED",
      success: true,
      data: historyEntry,
    });

    connections.forEach((ws) => {
      if (ws.readyState === 1) {
        // WebSocket.OPEN
        ws.send(message);
      }
    });
  });

  console.log(`[WebSocket] Event subscriptions set up for ${registry.getAgentCount()} agents`);
}

/**
 * Broadcast message to all connections for a specific agent
 */
export function broadcastToAgent(agentId: string, message: any): void {
  const connections = agentConnections.get(agentId);
  if (!connections) return;

  const messageStr = JSON.stringify(message);
  connections.forEach((ws) => {
    if (ws.readyState === 1) {
      // WebSocket.OPEN
      ws.send(messageStr);
    }
  });
}

/**
 * Broadcast message to all connected clients
 */
export function broadcastToAll(message: any): void {
  const messageStr = JSON.stringify(message);
  agentConnections.forEach((connections) => {
    connections.forEach((ws) => {
      if (ws.readyState === 1) {
        // WebSocket.OPEN
        ws.send(messageStr);
      }
    });
  });
}
