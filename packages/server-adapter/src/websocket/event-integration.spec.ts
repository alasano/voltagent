import { WebSocketConnectionManager } from "./event-integration";
import type { LocalAgentRegistry, AgentHistoryEntry } from "@voltagent/core";
import { AgentEventEmitter } from "@voltagent/core";

// Local mock creation functions
class MockWebSocket {
  public readyState: number = 1; // OPEN
  public send = jest.fn();
  public close = jest.fn();
  public addEventListener = jest.fn();
  public removeEventListener = jest.fn();

  public simulateMessage(data: any) {
    const event = { data: JSON.stringify(data) };
    const messageHandler = this.addEventListener.mock.calls.find(
      (call) => call[0] === "message",
    )?.[1];
    if (messageHandler) messageHandler(event);
  }

  public simulateClose() {
    this.readyState = 3; // CLOSED
    const closeHandler = this.addEventListener.mock.calls.find((call) => call[0] === "close")?.[1];
    if (closeHandler) closeHandler({});
  }

  public simulateError(error: Error) {
    const errorHandler = this.addEventListener.mock.calls.find((call) => call[0] === "error")?.[1];
    if (errorHandler) errorHandler(error);
  }
}

function createMockWebSocketConnection(agentId?: string): MockWebSocket {
  return new MockWebSocket();
}

function createMockAgent(overrides: any = {}): any {
  return {
    id: "test-agent-" + Math.random().toString(36).substr(2, 9),
    name: "Test Agent",
    instructions: "Test instructions",
    generateText: jest.fn().mockResolvedValue({ text: "Mock response" }),
    streamText: jest.fn(),
    generateObject: jest.fn(),
    streamObject: jest.fn(),
    getHistory: jest.fn().mockResolvedValue([]),
    getFullState: jest.fn().mockReturnValue({
      id: "test-agent",
      name: "Test Agent",
      description: "Test instructions",
      status: "idle",
      model: "test-model",
    }),
    getToolsForApi: jest.fn().mockReturnValue([]),
    getSubAgents: jest.fn().mockReturnValue([]),
    isTelemetryConfigured: jest.fn().mockReturnValue(false),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
    ...overrides,
  };
}

function createMockRegistry(): jest.Mocked<LocalAgentRegistry> {
  return {
    getAgent: jest.fn(),
    getAllAgents: jest.fn().mockReturnValue([]),
    getAgentCount: jest.fn().mockReturnValue(0),
    registerAgent: jest.fn(),
    unregisterAgent: jest.fn(),
    registerAgentRelationship: jest.fn(),
  } as any;
}

function createMockHistoryEntry(overrides: Partial<AgentHistoryEntry> = {}): AgentHistoryEntry {
  return {
    id: "history-" + Math.random().toString(36).substr(2, 9),
    input: "Test input",
    output: "Test output",
    status: "completed",
    startTime: new Date("2024-01-01T00:00:00Z"),
    endTime: new Date("2024-01-01T00:01:00Z"),
    steps: [],
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
    ...overrides,
  };
}

// Mock AgentEventEmitter
const mockEventEmitter = {
  onHistoryUpdate: jest.fn(),
  onHistoryEntryCreated: jest.fn(),
  emit: jest.fn(),
};

jest.mock("@voltagent/core", () => ({
  AgentEventEmitter: {
    getInstance: jest.fn(() => mockEventEmitter),
  },
}));

describe("WebSocketConnectionManager", () => {
  let manager: WebSocketConnectionManager;
  let mockRegistry: jest.Mocked<LocalAgentRegistry>;
  let mockConnection: MockWebSocket;

  beforeEach(() => {
    // Reset only the mocks that need to be reset, not the event handler registrations
    mockRegistry = createMockRegistry();
    mockConnection = createMockWebSocketConnection();

    // Clear only the send mock, not the event emitter mocks
    if (mockConnection && mockConnection.send) {
      mockConnection.send.mockClear();
    }

    // Create manager after setting up mocks
    manager = new WebSocketConnectionManager(mockRegistry);
  });

  afterEach(() => {
    // Cleanup any connections to prevent memory leaks
    if (manager) {
      // Access private connections map for cleanup
      const connections = (manager as any).connections;
      connections.clear();
    }
  });

  describe("constructor", () => {
    it("should create instance with registry", () => {
      expect(manager).toBeInstanceOf(WebSocketConnectionManager);
      expect(AgentEventEmitter.getInstance).toHaveBeenCalled();
    });

    it("should setup event subscriptions", () => {
      expect(mockEventEmitter.onHistoryUpdate).toHaveBeenCalledWith(expect.any(Function));
      expect(mockEventEmitter.onHistoryEntryCreated).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("addConnection", () => {
    it("should add connection for new agent", () => {
      const agentId = "agent-1";

      manager.addConnection(agentId, mockConnection);

      const stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.agentCount).toBe(1);
    });

    it("should add multiple connections for same agent", () => {
      const agentId = "agent-1";
      const connection2 = createMockWebSocketConnection();

      manager.addConnection(agentId, mockConnection);
      manager.addConnection(agentId, connection2);

      const stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(2);
      expect(stats.agentCount).toBe(1);
    });

    it("should handle connections for different agents", () => {
      const agentId1 = "agent-1";
      const agentId2 = "agent-2";
      const connection2 = createMockWebSocketConnection();

      manager.addConnection(agentId1, mockConnection);
      manager.addConnection(agentId2, connection2);

      const stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(2);
      expect(stats.agentCount).toBe(2);
    });

    it("should handle duplicate connection additions", () => {
      const agentId = "agent-1";

      manager.addConnection(agentId, mockConnection);
      manager.addConnection(agentId, mockConnection); // Same connection

      const stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(1); // Set prevents duplicates
      expect(stats.agentCount).toBe(1);
    });
  });

  describe("removeConnection", () => {
    beforeEach(() => {
      manager.addConnection("agent-1", mockConnection);
    });

    it("should remove connection for agent", () => {
      manager.removeConnection("agent-1", mockConnection);

      const stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.agentCount).toBe(0);
    });

    it("should handle removal of non-existent connection", () => {
      const nonExistentConnection = createMockWebSocketConnection();

      manager.removeConnection("agent-1", nonExistentConnection);

      const stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(1); // Original connection still there
      expect(stats.agentCount).toBe(1);
    });

    it("should handle removal from non-existent agent", () => {
      manager.removeConnection("non-existent-agent", mockConnection);

      const stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(1); // Original connection still there
      expect(stats.agentCount).toBe(1);
    });

    it("should remove agent entry when last connection removed", () => {
      const connection2 = createMockWebSocketConnection();
      manager.addConnection("agent-1", connection2);

      // Remove first connection
      manager.removeConnection("agent-1", mockConnection);
      let stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.agentCount).toBe(1);

      // Remove second connection
      manager.removeConnection("agent-1", connection2);
      stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.agentCount).toBe(0);
    });
  });

  describe("broadcastToAgent", () => {
    beforeEach(() => {
      manager.addConnection("agent-1", mockConnection);
    });

    it("should broadcast message to agent connections", () => {
      const message = { type: "TEST", data: "test data" };

      manager.broadcastToAgent("agent-1", message);

      expect(mockConnection.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it("should broadcast to multiple connections for same agent", () => {
      const connection2 = createMockWebSocketConnection();
      manager.addConnection("agent-1", connection2);

      const message = { type: "TEST", data: "test data" };

      manager.broadcastToAgent("agent-1", message);

      expect(mockConnection.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(connection2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it("should handle broadcast to non-existent agent", () => {
      manager.broadcastToAgent("non-existent-agent", { type: "TEST" });

      // Should not throw and should not call send
      expect(mockConnection.send).not.toHaveBeenCalled();
    });

    it("should skip closed connections", () => {
      mockConnection.readyState = 3; // CLOSED

      const message = { type: "TEST", data: "test data" };
      manager.broadcastToAgent("agent-1", message);

      expect(mockConnection.send).not.toHaveBeenCalled();
    });

    it("should remove failed connections", () => {
      mockConnection.send.mockImplementation(() => {
        throw new Error("Send failed");
      });

      const message = { type: "TEST", data: "test data" };
      manager.broadcastToAgent("agent-1", message);

      const stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.agentCount).toBe(0);
    });

    it("should handle send errors gracefully", () => {
      mockConnection.send.mockImplementation(() => {
        throw new Error("WebSocket send failed");
      });

      expect(() => {
        manager.broadcastToAgent("agent-1", { type: "TEST" });
      }).not.toThrow();
    });
  });

  describe("getInitialAgentState", () => {
    it("should return agent history when agent exists", async () => {
      const mockAgent = createMockAgent();
      const mockHistory = [
        createMockHistoryEntry({ id: "entry-1" }),
        createMockHistoryEntry({ id: "entry-2" }),
      ];
      mockAgent.getHistory.mockResolvedValue(mockHistory);
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const result = await manager.getInitialAgentState("agent-1");

      expect(result).toEqual({
        type: "HISTORY_LIST",
        success: true,
        data: mockHistory,
      });
      expect(mockAgent.getHistory).toHaveBeenCalled();
    });

    it("should return null when agent not found", async () => {
      mockRegistry.getAgent.mockReturnValue(undefined);

      const result = await manager.getInitialAgentState("non-existent-agent");

      expect(result).toBeNull();
    });

    it("should return null when agent has no history", async () => {
      const mockAgent = createMockAgent();
      mockAgent.getHistory.mockResolvedValue([]);
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const result = await manager.getInitialAgentState("agent-1");

      expect(result).toBeNull();
    });

    it("should handle getHistory errors", async () => {
      const mockAgent = createMockAgent();
      mockAgent.getHistory.mockRejectedValue(new Error("History fetch failed"));
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const result = await manager.getInitialAgentState("agent-1");

      expect(result).toBeNull();
    });

    it("should return null when history is null", async () => {
      const mockAgent = createMockAgent();
      mockAgent.getHistory.mockResolvedValue(null);
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const result = await manager.getInitialAgentState("agent-1");

      expect(result).toBeNull();
    });
  });

  describe("event subscriptions", () => {
    it("should handle history update events", () => {
      manager.addConnection("agent-1", mockConnection);

      // Verify the event handler was registered
      expect(mockEventEmitter.onHistoryUpdate).toHaveBeenCalled();
      expect(mockEventEmitter.onHistoryUpdate.mock.calls.length).toBeGreaterThan(0);

      // Get the history update handler
      const calls = mockEventEmitter.onHistoryUpdate.mock.calls;
      const historyUpdateHandler = calls[calls.length - 1][0];

      const mockHistoryEntry = createMockHistoryEntry({ id: "updated-entry" });
      (mockHistoryEntry as any)._sequenceNumber = 12345;

      // Spy on broadcastToAgent to see if it's being called
      const broadcastSpy = jest.spyOn(manager, "broadcastToAgent");

      historyUpdateHandler("agent-1", mockHistoryEntry);

      // Check if broadcastToAgent was called
      expect(broadcastSpy).toHaveBeenCalledWith("agent-1", {
        type: "HISTORY_UPDATE",
        success: true,
        sequenceNumber: 12345,
        data: mockHistoryEntry,
      });

      expect(mockConnection.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "HISTORY_UPDATE",
          success: true,
          sequenceNumber: 12345,
          data: mockHistoryEntry,
        }),
      );
    });

    it("should handle history update events without sequence number", () => {
      manager.addConnection("agent-1", mockConnection);

      const calls = mockEventEmitter.onHistoryUpdate.mock.calls;
      const historyUpdateHandler = calls[calls.length - 1][0];
      const mockHistoryEntry = createMockHistoryEntry({ id: "updated-entry" });

      // Mock Date.now for consistent testing
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => 67890);

      historyUpdateHandler("agent-1", mockHistoryEntry);

      expect(mockConnection.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "HISTORY_UPDATE",
          success: true,
          sequenceNumber: 67890,
          data: mockHistoryEntry,
        }),
      );

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it("should handle history entry created events", () => {
      manager.addConnection("agent-1", mockConnection);

      // Get the history created handler
      const createdCalls = mockEventEmitter.onHistoryEntryCreated.mock.calls;
      const historyCreatedHandler = createdCalls[createdCalls.length - 1][0];

      const mockHistoryEntry = createMockHistoryEntry({ id: "new-entry" });

      historyCreatedHandler("agent-1", mockHistoryEntry);

      expect(mockConnection.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "HISTORY_CREATED",
          success: true,
          data: mockHistoryEntry,
        }),
      );
    });

    it("should broadcast events to all connections for agent", () => {
      const connection2 = createMockWebSocketConnection();
      manager.addConnection("agent-1", mockConnection);
      manager.addConnection("agent-1", connection2);

      const calls = mockEventEmitter.onHistoryUpdate.mock.calls;
      const historyUpdateHandler = calls[calls.length - 1][0];
      const mockHistoryEntry = createMockHistoryEntry();

      historyUpdateHandler("agent-1", mockHistoryEntry);

      expect(mockConnection.send).toHaveBeenCalled();
      expect(connection2.send).toHaveBeenCalled();
    });

    it("should not broadcast to other agents", () => {
      const connection2 = createMockWebSocketConnection();
      manager.addConnection("agent-1", mockConnection);
      manager.addConnection("agent-2", connection2);

      const calls = mockEventEmitter.onHistoryUpdate.mock.calls;
      const historyUpdateHandler = calls[calls.length - 1][0];
      const mockHistoryEntry = createMockHistoryEntry();

      historyUpdateHandler("agent-1", mockHistoryEntry);

      expect(mockConnection.send).toHaveBeenCalled();
      expect(connection2.send).not.toHaveBeenCalled();
    });
  });

  describe("handleTestConnection", () => {
    it("should send test connection message", () => {
      manager.handleTestConnection(mockConnection);

      expect(mockConnection.send).toHaveBeenCalledWith(expect.stringContaining("CONNECTION_TEST"));

      const sentMessage = JSON.parse(mockConnection.send.mock.calls[0][0]);
      expect(sentMessage).toMatchObject({
        type: "CONNECTION_TEST",
        success: true,
        data: {
          message: "WebSocket test connection successful",
          timestamp: expect.any(String),
        },
      });
    });

    it("should handle connection send errors", () => {
      mockConnection.send.mockImplementation(() => {
        throw new Error("Send failed");
      });

      expect(() => {
        manager.handleTestConnection(mockConnection);
      }).not.toThrow();
    });
  });

  describe("handleEchoMessage", () => {
    it("should echo JSON string messages", () => {
      const message = '{"test": "data"}';

      manager.handleEchoMessage(mockConnection, message);

      expect(mockConnection.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "ECHO",
          success: true,
          data: { test: "data" },
        }),
      );
    });

    it("should echo object messages", () => {
      const message = { test: "data", number: 42 };

      manager.handleEchoMessage(mockConnection, message);

      expect(mockConnection.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "ECHO",
          success: true,
          data: message,
        }),
      );
    });

    it("should handle invalid JSON messages", () => {
      const invalidMessage = "invalid json {";

      expect(() => {
        manager.handleEchoMessage(mockConnection, invalidMessage);
      }).not.toThrow();
    });

    it("should handle connection send errors in echo", () => {
      mockConnection.send.mockImplementation(() => {
        throw new Error("Send failed");
      });

      expect(() => {
        manager.handleEchoMessage(mockConnection, { test: "data" });
      }).not.toThrow();
    });
  });

  describe("getConnectionStats", () => {
    it("should return correct stats for no connections", () => {
      const stats = manager.getConnectionStats();

      expect(stats).toEqual({
        totalConnections: 0,
        agentCount: 0,
      });
    });

    it("should return correct stats for single agent", () => {
      manager.addConnection("agent-1", mockConnection);

      const stats = manager.getConnectionStats();

      expect(stats).toEqual({
        totalConnections: 1,
        agentCount: 1,
      });
    });

    it("should return correct stats for multiple agents and connections", () => {
      const connection2 = createMockWebSocketConnection();
      const connection3 = createMockWebSocketConnection();

      manager.addConnection("agent-1", mockConnection);
      manager.addConnection("agent-1", connection2);
      manager.addConnection("agent-2", connection3);

      const stats = manager.getConnectionStats();

      expect(stats).toEqual({
        totalConnections: 3,
        agentCount: 2,
      });
    });

    it("should update stats after connection removal", () => {
      const connection2 = createMockWebSocketConnection();

      manager.addConnection("agent-1", mockConnection);
      manager.addConnection("agent-2", connection2);

      let stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(2);
      expect(stats.agentCount).toBe(2);

      manager.removeConnection("agent-1", mockConnection);

      stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.agentCount).toBe(1);
    });
  });

  describe("error scenarios", () => {
    it("should handle event subscription setup errors", () => {
      // Mock AgentEventEmitter to throw during subscription
      const throwingEventEmitter = {
        onHistoryUpdate: jest.fn(() => {
          throw new Error("Subscription failed");
        }),
        onHistoryEntryCreated: jest.fn(),
      };

      // Temporarily replace the mock
      const originalMock = (AgentEventEmitter.getInstance as jest.Mock).getMockImplementation();
      (AgentEventEmitter.getInstance as jest.Mock).mockReturnValue(throwingEventEmitter);

      expect(() => {
        new WebSocketConnectionManager(createMockRegistry());
      }).toThrow("Subscription failed");

      // Restore the original mock for other tests
      (AgentEventEmitter.getInstance as jest.Mock).mockImplementation(originalMock);
    });

    it("should handle broadcasting to closed connections", () => {
      manager.addConnection("agent-1", mockConnection);
      mockConnection.readyState = 2; // CLOSING

      manager.broadcastToAgent("agent-1", { type: "TEST" });

      expect(mockConnection.send).not.toHaveBeenCalled();
    });

    it("should handle multiple connection failures gracefully", () => {
      const connection2 = createMockWebSocketConnection();
      const connection3 = createMockWebSocketConnection();

      manager.addConnection("agent-1", mockConnection);
      manager.addConnection("agent-1", connection2);
      manager.addConnection("agent-1", connection3);

      // Make all connections fail
      mockConnection.send.mockImplementation(() => {
        throw new Error("Fail 1");
      });
      connection2.send.mockImplementation(() => {
        throw new Error("Fail 2");
      });
      connection3.send.mockImplementation(() => {
        throw new Error("Fail 3");
      });

      expect(() => {
        manager.broadcastToAgent("agent-1", { type: "TEST" });
      }).not.toThrow();

      const stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.agentCount).toBe(0);
    });
  });

  describe("memory management", () => {
    it("should not leak connections after removal", () => {
      manager.addConnection("agent-1", mockConnection);
      manager.removeConnection("agent-1", mockConnection);

      // Try to broadcast to removed connection
      manager.broadcastToAgent("agent-1", { type: "TEST" });

      expect(mockConnection.send).not.toHaveBeenCalled();
    });

    it("should clean up empty agent entries", () => {
      manager.addConnection("agent-1", mockConnection);

      let stats = manager.getConnectionStats();
      expect(stats.agentCount).toBe(1);

      manager.removeConnection("agent-1", mockConnection);

      stats = manager.getConnectionStats();
      expect(stats.agentCount).toBe(0);
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete agent lifecycle", async () => {
      const mockAgent = createMockAgent({ id: "lifecycle-agent" });
      const mockHistory = [createMockHistoryEntry()];
      mockAgent.getHistory.mockResolvedValue(mockHistory);
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      // Add connection
      manager.addConnection("lifecycle-agent", mockConnection);

      // Get initial state
      const initialState = await manager.getInitialAgentState("lifecycle-agent");
      expect(initialState).toBeDefined();

      // Simulate history update event
      const calls = mockEventEmitter.onHistoryUpdate.mock.calls;
      const historyUpdateHandler = calls[calls.length - 1][0];
      historyUpdateHandler("lifecycle-agent", createMockHistoryEntry());

      // Remove connection
      manager.removeConnection("lifecycle-agent", mockConnection);

      const stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(0);
    });

    it("should handle concurrent operations", () => {
      const connections = Array.from({ length: 10 }, () => createMockWebSocketConnection());

      // Add all connections simultaneously
      connections.forEach((conn, index) => {
        manager.addConnection(`agent-${index % 3}`, conn);
      });

      let stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(10);
      expect(stats.agentCount).toBe(3);

      // Broadcast to all agents
      manager.broadcastToAgent("agent-0", { type: "BROADCAST_TEST" });
      manager.broadcastToAgent("agent-1", { type: "BROADCAST_TEST" });
      manager.broadcastToAgent("agent-2", { type: "BROADCAST_TEST" });

      // Verify broadcasts
      connections.forEach((conn, index) => {
        if (index % 3 === 0) {
          // agent-0 connections
          expect(conn.send).toHaveBeenCalled();
        }
      });

      // Remove all connections
      connections.forEach((conn, index) => {
        manager.removeConnection(`agent-${index % 3}`, conn);
      });

      stats = manager.getConnectionStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.agentCount).toBe(0);
    });
  });
});
