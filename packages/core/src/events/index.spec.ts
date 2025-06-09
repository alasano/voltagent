import type { AgentHistoryEntry } from "../agent/history";
import type { AgentStatus } from "../agent/types";
import { AgentEventEmitter } from "./index";

// Mock LocalAgentRegistry
jest.mock("../registry/local");

describe("AgentEventEmitter", () => {
  let eventEmitter: AgentEventEmitter;

  beforeEach(() => {
    // Reset the singleton instance before each test
    (AgentEventEmitter as any).instance = null;
    eventEmitter = AgentEventEmitter.getInstance();
    jest.clearAllMocks();
  });

  describe("getInstance", () => {
    it("should return the same instance on multiple calls", () => {
      const instance1 = AgentEventEmitter.getInstance();
      const instance2 = AgentEventEmitter.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("agentRegistered events", () => {
    it("should emit and receive agent registered events", (done) => {
      const agentId = "test-agent";

      eventEmitter.onAgentRegistered((receivedAgentId) => {
        expect(receivedAgentId).toBe(agentId);
        done();
      });

      eventEmitter.emitAgentRegistered(agentId);
    });

    it("should allow unsubscribing from agent registered events", () => {
      const callback = jest.fn();
      const unsubscribe = eventEmitter.onAgentRegistered(callback);

      eventEmitter.emitAgentRegistered("test-agent");
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      eventEmitter.emitAgentRegistered("test-agent-2");
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("agentUnregistered events", () => {
    it("should emit and receive agent unregistered events", (done) => {
      const agentId = "test-agent";

      eventEmitter.onAgentUnregistered((receivedAgentId) => {
        expect(receivedAgentId).toBe(agentId);
        done();
      });

      eventEmitter.emitAgentUnregistered(agentId);
    });

    it("should allow unsubscribing from agent unregistered events", () => {
      const callback = jest.fn();
      const unsubscribe = eventEmitter.onAgentUnregistered(callback);

      eventEmitter.emitAgentUnregistered("test-agent");
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      eventEmitter.emitAgentUnregistered("test-agent-2");
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("timeline event publishing", () => {
    // Test history entry
    const historyEntry: Partial<AgentHistoryEntry> = {
      id: "test-history-id",
      startTime: new Date("2023-01-01T00:00:00Z"),
      input: "Test input",
      output: "Test output",
      status: "completed" as AgentStatus,
      steps: [],
    };

    // Mock historyManager
    const mockHistoryManager = {
      persistTimelineEvent: jest.fn().mockResolvedValue(historyEntry as AgentHistoryEntry),
      updateEntry: jest.fn(),
      addEventToEntry: jest.fn(),
      updateTrackedEvent: jest.fn(),
    };

    // Mock agent with history and historyManager
    const mockAgent = {
      name: "TestAgent",
      getHistory: jest.fn().mockResolvedValue([historyEntry as AgentHistoryEntry]),
      id: "test-agent",
      getHistoryManager: jest.fn().mockReturnValue(mockHistoryManager),
    };

    // Mock registry
    const mockRegistry = {
      getAgent: jest.fn().mockReturnValue(mockAgent),
      getParentAgentIds: jest.fn().mockReturnValue([]),
    };

    beforeEach(() => {
      // Reset mock counts
      mockHistoryManager.persistTimelineEvent.mockClear();
      mockAgent.getHistoryManager.mockClear();
      mockRegistry.getAgent.mockClear();
      mockRegistry.getParentAgentIds.mockClear();
    });

    it("should publish timeline events with registry", async () => {
      // Test event to be published
      const testEvent = {
        id: "test-event-id",
        name: "tool:start",
        type: "tool" as const,
        startTime: "2023-01-01T00:00:00Z",
        status: "running" as const,
        input: { query: "test query" },
        output: null,
        metadata: {
          displayName: "Test Tool",
          agentId: "test-agent",
        },
        traceId: "test-history-id",
      };

      // Act: publish an event
      const result = await eventEmitter.publishTimelineEvent({
        agentId: "test-agent",
        historyId: "test-history-id",
        event: testEvent as any,
        registry: mockRegistry as any,
      });

      // Assert: event was persisted
      expect(mockHistoryManager.persistTimelineEvent).toHaveBeenCalledWith(
        "test-history-id",
        testEvent,
      );
      expect(result).toBe(historyEntry);
    });

    it("should handle missing agent gracefully", async () => {
      // Setup registry to return undefined for agent
      mockRegistry.getAgent.mockReturnValue(undefined);

      const testEvent = {
        id: "test-event-id",
        name: "tool:start",
        type: "tool" as const,
        startTime: "2023-01-01T00:00:00Z",
        status: "running" as const,
        input: { query: "test query" },
        output: null,
        metadata: {
          displayName: "Test Tool",
          agentId: "missing-agent",
        },
        traceId: "test-history-id",
      };

      // Act: publish an event for missing agent
      const result = await eventEmitter.publishTimelineEvent({
        agentId: "missing-agent",
        historyId: "test-history-id",
        event: testEvent as any,
        registry: mockRegistry as any,
      });

      // Assert: should return undefined and not call persistTimelineEvent
      expect(result).toBeUndefined();
      expect(mockHistoryManager.persistTimelineEvent).not.toHaveBeenCalled();
    });
  });

  describe("hierarchical event propagation", () => {
    // Redefine the test data and mocks needed for hierarchical tests
    const historyEntry: Partial<AgentHistoryEntry> = {
      id: "test-history-id",
      startTime: new Date("2023-01-01T00:00:00Z"),
      input: "Test input",
      output: "Test output",
      status: "completed" as AgentStatus,
      steps: [],
    };

    const mockHistoryManager = {
      persistTimelineEvent: jest.fn().mockResolvedValue(historyEntry as AgentHistoryEntry),
      updateEntry: jest.fn(),
      addEventToEntry: jest.fn(),
      updateTrackedEvent: jest.fn(),
    };

    const mockAgent = {
      name: "TestAgent",
      getHistory: jest.fn().mockResolvedValue([historyEntry as AgentHistoryEntry]),
      id: "test-agent",
      getHistoryManager: jest.fn().mockReturnValue(mockHistoryManager),
    };

    it("should propagate history entry created events to parent agents", async () => {
      // Setup registry with parent-child relationship
      const mockRegistry = {
        getAgent: jest.fn(),
        getParentAgentIds: jest.fn().mockReturnValue(["parent-agent"]),
      };

      const parentAgent = {
        name: "ParentAgent",
        getHistory: jest.fn().mockResolvedValue([historyEntry as AgentHistoryEntry]),
        id: "parent-agent",
        getHistoryManager: jest.fn().mockReturnValue({
          persistTimelineEvent: jest.fn().mockResolvedValue(historyEntry as AgentHistoryEntry),
        }),
      };

      mockRegistry.getAgent.mockImplementation((id: string) => {
        if (id === "parent-agent") return parentAgent;
        if (id === "child-agent") return mockAgent;
        return undefined;
      });

      const publishSpy = jest.spyOn(eventEmitter, "publishTimelineEvent");

      // Act
      await eventEmitter.emitHierarchicalHistoryEntryCreated(
        "child-agent",
        historyEntry as AgentHistoryEntry,
        mockRegistry as any,
      );

      // Assert
      expect(mockRegistry.getParentAgentIds).toHaveBeenCalledWith("child-agent");
      expect(mockRegistry.getAgent).toHaveBeenCalledWith("parent-agent");
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: "parent-agent",
          historyId: "test-history-id",
          event: expect.objectContaining({
            name: "agent:start",
            type: "agent",
            metadata: expect.objectContaining({
              displayName: "TestAgent",
              id: "child-agent",
              agentId: "parent-agent",
            }),
          }),
          registry: mockRegistry,
        }),
      );

      publishSpy.mockRestore();
    });

    it("should propagate completed history updates to parent agents", async () => {
      // Setup registry with parent-child relationship
      const mockRegistry = {
        getAgent: jest.fn(),
        getParentAgentIds: jest.fn().mockReturnValue(["parent-agent"]),
      };

      const parentAgent = {
        name: "ParentAgent",
        getHistory: jest.fn().mockResolvedValue([historyEntry as AgentHistoryEntry]),
        id: "parent-agent",
        getHistoryManager: jest.fn().mockReturnValue({
          persistTimelineEvent: jest.fn().mockResolvedValue(historyEntry as AgentHistoryEntry),
        }),
      };

      mockRegistry.getAgent.mockImplementation((id: string) => {
        if (id === "parent-agent") return parentAgent;
        if (id === "child-agent") return mockAgent;
        return undefined;
      });

      const publishSpy = jest.spyOn(eventEmitter, "publishTimelineEvent");

      // Setup completed history entry
      const completedEntry = {
        ...historyEntry,
        status: "completed" as AgentStatus,
      };

      // Act
      await eventEmitter.emitHierarchicalHistoryUpdate(
        "child-agent",
        completedEntry as AgentHistoryEntry,
        mockRegistry as any,
      );

      // Assert
      expect(mockRegistry.getParentAgentIds).toHaveBeenCalledWith("child-agent");
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: "parent-agent",
          historyId: "test-history-id",
          event: expect.objectContaining({
            name: "agent:success",
            type: "agent",
            status: "completed",
            metadata: expect.objectContaining({
              displayName: "TestAgent",
              id: "child-agent",
              agentId: "parent-agent",
            }),
          }),
          registry: mockRegistry,
        }),
      );

      publishSpy.mockRestore();
    });

    it("should handle multi-level hierarchy", async () => {
      // Setup registry with three-level hierarchy: child -> parent -> grandparent
      const mockRegistry = {
        getAgent: jest.fn(),
        getParentAgentIds: jest
          .fn()
          .mockReturnValueOnce(["parent-agent"]) // child's parent
          .mockReturnValueOnce(["grandparent-agent"]) // parent's parent
          .mockReturnValueOnce([]), // grandparent has no parents
      };

      const childAgent = {
        name: "ChildAgent",
        getHistory: jest.fn().mockResolvedValue([historyEntry as AgentHistoryEntry]),
        id: "child-agent",
        getHistoryManager: jest.fn().mockReturnValue({
          persistTimelineEvent: jest.fn().mockResolvedValue(historyEntry as AgentHistoryEntry),
        }),
      };

      const parentAgent = {
        name: "ParentAgent",
        getHistory: jest.fn().mockResolvedValue([historyEntry as AgentHistoryEntry]),
        id: "parent-agent",
        getHistoryManager: jest.fn().mockReturnValue({
          persistTimelineEvent: jest.fn().mockResolvedValue(historyEntry as AgentHistoryEntry),
        }),
      };

      const grandparentAgent = {
        name: "GrandparentAgent",
        getHistory: jest.fn().mockResolvedValue([historyEntry as AgentHistoryEntry]),
        id: "grandparent-agent",
        getHistoryManager: jest.fn().mockReturnValue({
          persistTimelineEvent: jest.fn().mockResolvedValue(historyEntry as AgentHistoryEntry),
        }),
      };

      mockRegistry.getAgent.mockImplementation((id: string) => {
        if (id === "child-agent") return childAgent;
        if (id === "parent-agent") return parentAgent;
        if (id === "grandparent-agent") return grandparentAgent;
        return undefined;
      });

      const publishSpy = jest.spyOn(eventEmitter, "publishTimelineEvent");

      // Act
      await eventEmitter.emitHierarchicalHistoryEntryCreated(
        "child-agent",
        historyEntry as AgentHistoryEntry,
        mockRegistry as any,
      );

      // Assert - should propagate to both parent and grandparent
      expect(mockRegistry.getParentAgentIds).toHaveBeenCalledWith("child-agent");
      expect(mockRegistry.getParentAgentIds).toHaveBeenCalledWith("parent-agent");

      // Should publish to parent
      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ agentId: "parent-agent" }));

      // Should publish to grandparent
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: "grandparent-agent" }),
      );

      publishSpy.mockRestore();
    });

    it("should prevent infinite loops in cyclic agent relationships", async () => {
      // Setup a cycle: A -> B -> A
      const mockRegistry = {
        getAgent: jest.fn(),
        getParentAgentIds: jest
          .fn()
          .mockReturnValueOnce(["agent-B"]) // agent-A's parent is agent-B
          .mockReturnValueOnce(["agent-A"]), // agent-B's parent is agent-A (cycle)
      };

      const agentA = {
        name: "AgentA",
        getHistory: jest.fn().mockResolvedValue([historyEntry as AgentHistoryEntry]),
        id: "agent-A",
        getHistoryManager: jest.fn().mockReturnValue({
          persistTimelineEvent: jest.fn().mockResolvedValue(historyEntry as AgentHistoryEntry),
        }),
      };

      const agentB = {
        name: "AgentB",
        getHistory: jest.fn().mockResolvedValue([historyEntry as AgentHistoryEntry]),
        id: "agent-B",
        getHistoryManager: jest.fn().mockReturnValue({
          persistTimelineEvent: jest.fn().mockResolvedValue(historyEntry as AgentHistoryEntry),
        }),
      };

      mockRegistry.getAgent.mockImplementation((id: string) => {
        if (id === "agent-A") return agentA;
        if (id === "agent-B") return agentB;
        return undefined;
      });

      const publishSpy = jest.spyOn(eventEmitter, "publishTimelineEvent");

      // Act
      await eventEmitter.emitHierarchicalHistoryEntryCreated(
        "agent-A",
        historyEntry as AgentHistoryEntry,
        mockRegistry as any,
      );

      // Assert - should prevent infinite loop, so only 2 publications (A->B and B->A, then stop)
      expect(publishSpy).toHaveBeenCalledTimes(2);

      publishSpy.mockRestore();
    });

    it("should propagate error history updates to parent agents", async () => {
      // Setup registry with parent-child relationship
      const mockRegistry = {
        getAgent: jest.fn(),
        getParentAgentIds: jest.fn().mockReturnValue(["parent-agent"]),
      };

      const parentAgent = {
        name: "ParentAgent",
        getHistory: jest.fn().mockResolvedValue([historyEntry as AgentHistoryEntry]),
        id: "parent-agent",
        getHistoryManager: jest.fn().mockReturnValue({
          persistTimelineEvent: jest.fn().mockResolvedValue(historyEntry as AgentHistoryEntry),
        }),
      };

      mockRegistry.getAgent.mockImplementation((id: string) => {
        if (id === "parent-agent") return parentAgent;
        if (id === "child-agent") return mockAgent;
        return undefined;
      });

      const publishSpy = jest.spyOn(eventEmitter, "publishTimelineEvent");

      // Setup error history entry
      const errorEntry = {
        ...historyEntry,
        status: "error" as AgentStatus,
        output: "Error message",
      };

      // Act
      await eventEmitter.emitHierarchicalHistoryUpdate(
        "child-agent",
        errorEntry as AgentHistoryEntry,
        mockRegistry as any,
      );

      // Assert
      expect(mockRegistry.getParentAgentIds).toHaveBeenCalledWith("child-agent");
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: "parent-agent",
          historyId: "test-history-id",
          event: expect.objectContaining({
            name: "agent:error",
            type: "agent",
            status: "error",
            level: "ERROR",
            statusMessage: expect.objectContaining({
              message: "Error message",
            }),
            metadata: expect.objectContaining({
              displayName: "TestAgent",
              id: "child-agent",
              agentId: "parent-agent",
            }),
          }),
          registry: mockRegistry,
        }),
      );

      publishSpy.mockRestore();
    });

    it("should handle multi-level hierarchy for updates", async () => {
      // Setup registry with three-level hierarchy for updates
      const mockRegistry = {
        getAgent: jest.fn(),
        getParentAgentIds: jest
          .fn()
          .mockReturnValueOnce(["parent-agent"]) // child's parent
          .mockReturnValueOnce(["grandparent-agent"]) // parent's parent
          .mockReturnValueOnce([]), // grandparent has no parents
      };

      const childAgent = {
        name: "ChildAgent",
        getHistory: jest.fn().mockResolvedValue([historyEntry as AgentHistoryEntry]),
        id: "child-agent",
        getHistoryManager: jest.fn().mockReturnValue({
          persistTimelineEvent: jest.fn().mockResolvedValue(historyEntry as AgentHistoryEntry),
        }),
      };

      const parentAgent = {
        name: "ParentAgent",
        getHistory: jest.fn().mockResolvedValue([historyEntry as AgentHistoryEntry]),
        id: "parent-agent",
        getHistoryManager: jest.fn().mockReturnValue({
          persistTimelineEvent: jest.fn().mockResolvedValue(historyEntry as AgentHistoryEntry),
        }),
      };

      const grandparentAgent = {
        name: "GrandparentAgent",
        getHistory: jest.fn().mockResolvedValue([historyEntry as AgentHistoryEntry]),
        id: "grandparent-agent",
        getHistoryManager: jest.fn().mockReturnValue({
          persistTimelineEvent: jest.fn().mockResolvedValue(historyEntry as AgentHistoryEntry),
        }),
      };

      mockRegistry.getAgent.mockImplementation((id: string) => {
        if (id === "child-agent") return childAgent;
        if (id === "parent-agent") return parentAgent;
        if (id === "grandparent-agent") return grandparentAgent;
        return undefined;
      });

      const publishSpy = jest.spyOn(eventEmitter, "publishTimelineEvent");

      // Act
      await eventEmitter.emitHierarchicalHistoryUpdate(
        "child-agent",
        historyEntry as AgentHistoryEntry,
        mockRegistry as any,
      );

      // Assert - should propagate through the hierarchy
      expect(mockRegistry.getParentAgentIds).toHaveBeenCalledWith("child-agent");
      expect(mockRegistry.getParentAgentIds).toHaveBeenCalledWith("parent-agent");

      // Should publish to both parent and grandparent
      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ agentId: "parent-agent" }));
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: "grandparent-agent" }),
      );

      publishSpy.mockRestore();
    });
  });
});
