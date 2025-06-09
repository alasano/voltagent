export { WebSocketConnectionManager } from "./event-integration";

/**
 * WebSocket handler factory for creating framework-agnostic WebSocket handlers
 */
export interface WebSocketHandlerFactory {
  /**
   * Create agent-specific WebSocket handler
   */
  createAgentHandler(connectionManager: any): (connection: any, request: any) => Promise<void>;

  /**
   * Create test WebSocket handler
   */
  createTestHandler(connectionManager: any): (connection: any, request: any) => void;
}

/**
 * Extract agent ID from WebSocket URL
 */
export function extractAgentIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url, "ws://localhost");
    const pathParts = urlObj.pathname.split("/");

    // Handle /ws/agents/:id pattern
    if (pathParts.length >= 4 && pathParts[1] === "ws" && pathParts[2] === "agents") {
      return decodeURIComponent(pathParts[3]);
    }

    return null;
  } catch (error) {
    console.error("Error extracting agent ID from URL:", error);
    return null;
  }
}

/**
 * Check if URL is a test WebSocket connection
 */
export function isTestWebSocketUrl(url: string): boolean {
  try {
    const urlObj = new URL(url, "ws://localhost");
    return urlObj.pathname === "/ws";
  } catch (error) {
    return false;
  }
}
