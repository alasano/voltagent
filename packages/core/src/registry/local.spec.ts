import { LocalAgentRegistry } from "./local";
import type { Agent } from "../agent";

// Mock Agent interface for testing
interface MockAgent extends Agent<any> {
  id: string;
  name: string;
  instructions: string;
}

// Helper function to create a mock agent
function createMockAgent(overrides: Partial<MockAgent> = {}): MockAgent {
  const mockAgent = {
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
      model: "mock-model",
    }),
    getToolsForApi: jest.fn().mockReturnValue([]),
    getSubAgents: jest.fn().mockReturnValue([]),
    isTelemetryConfigured: jest.fn().mockReturnValue(false),
    ...overrides,
  } as MockAgent;

  // Ensure id consistency
  if (overrides.id) {
    mockAgent.getFullState = jest.fn().mockReturnValue({
      id: overrides.id,
      name: mockAgent.name,
      description: mockAgent.instructions,
      status: "idle",
      model: "mock-model",
    });
  }

  return mockAgent;
}

describe("LocalAgentRegistry", () => {
  let registry: LocalAgentRegistry;

  beforeEach(() => {
    registry = new LocalAgentRegistry();
  });

  describe("constructor", () => {
    it("should initialize with empty state", () => {
      expect(registry.getAgentCount()).toBe(0);
      expect(registry.getAllAgents()).toEqual([]);
    });
  });

  describe("registerAgent", () => {
    it("should register agent successfully", () => {
      const agent = createMockAgent({ id: "test-agent-1" });

      registry.registerAgent(agent);

      expect(registry.getAgent("test-agent-1")).toBe(agent);
      expect(registry.getAgentCount()).toBe(1);
      expect(registry.getAllAgents()).toContain(agent);
    });

    it("should prevent duplicate agent registration", () => {
      const agent1 = createMockAgent({ id: "duplicate-agent" });
      const agent2 = createMockAgent({ id: "duplicate-agent" });

      registry.registerAgent(agent1);

      expect(() => {
        registry.registerAgent(agent2);
      }).toThrow("Agent with ID 'duplicate-agent' is already registered");

      expect(registry.getAgentCount()).toBe(1);
      expect(registry.getAgent("duplicate-agent")).toBe(agent1);
    });

    it("should handle agent with subagents", () => {
      const subAgent = createMockAgent({ id: "sub-agent" });
      const parentAgent = createMockAgent({
        id: "parent-agent",
        getSubAgents: jest.fn().mockReturnValue([subAgent]),
      });

      registry.registerAgent(parentAgent);

      expect(registry.getAgent("parent-agent")).toBe(parentAgent);
      expect(registry.getAgentCount()).toBe(1);
    });

    it("should register agent relationships separately", () => {
      const parentAgent = createMockAgent({ id: "parent-agent" });
      const childAgent = createMockAgent({ id: "child-agent" });

      registry.registerAgent(parentAgent);
      registry.registerAgent(childAgent);
      registry.registerSubAgent("parent-agent", "child-agent");

      expect(registry.getParentAgentIds("child-agent")).toContain("parent-agent");
    });

    it("should handle subagent registration", () => {
      const parentAgent = createMockAgent({ id: "parent-agent" });
      const childAgent = createMockAgent({ id: "child-agent" });

      registry.registerAgent(parentAgent);
      registry.registerAgent(childAgent);
      registry.registerSubAgent("parent-agent", "child-agent");

      expect(registry.getParentAgentIds("child-agent")).toEqual(["parent-agent"]);
    });
  });

  describe("getAgent", () => {
    it("should retrieve agent by id", () => {
      const agent = createMockAgent({ id: "retrieve-test" });
      registry.registerAgent(agent);

      const retrieved = registry.getAgent("retrieve-test");
      expect(retrieved).toBe(agent);
    });

    it("should return undefined for non-existent agent", () => {
      const result = registry.getAgent("non-existent");
      expect(result).toBeUndefined();
    });
  });

  describe("getAllAgents", () => {
    it("should return all registered agents", () => {
      const agent1 = createMockAgent({ id: "agent-1" });
      const agent2 = createMockAgent({ id: "agent-2" });

      registry.registerAgent(agent1);
      registry.registerAgent(agent2);

      const allAgents = registry.getAllAgents();
      expect(allAgents).toHaveLength(2);
      expect(allAgents).toContain(agent1);
      expect(allAgents).toContain(agent2);
    });

    it("should return empty array when no agents registered", () => {
      const allAgents = registry.getAllAgents();
      expect(allAgents).toEqual([]);
    });
  });

  describe("getAgentCount", () => {
    it("should return correct agent count", () => {
      expect(registry.getAgentCount()).toBe(0);

      const agent1 = createMockAgent({ id: "count-1" });
      registry.registerAgent(agent1);
      expect(registry.getAgentCount()).toBe(1);

      const agent2 = createMockAgent({ id: "count-2" });
      registry.registerAgent(agent2);
      expect(registry.getAgentCount()).toBe(2);
    });
  });

  describe("removeAgent", () => {
    it("should remove agent successfully", () => {
      const agent = createMockAgent({ id: "remove-test" });
      registry.registerAgent(agent);

      expect(registry.getAgent("remove-test")).toBe(agent);

      const result = registry.removeAgent("remove-test");

      expect(result).toBe(true);
      expect(registry.getAgent("remove-test")).toBeUndefined();
      expect(registry.getAgentCount()).toBe(0);
    });

    it("should handle removing non-existent agent gracefully", () => {
      const result = registry.removeAgent("non-existent");
      expect(result).toBe(false);
    });

    it("should cleanup relationships when removing parent agent", () => {
      const parentAgent = createMockAgent({ id: "parent-cleanup" });
      const childAgent = createMockAgent({ id: "child-cleanup" });

      registry.registerAgent(parentAgent);
      registry.registerAgent(childAgent);
      registry.registerSubAgent("parent-cleanup", "child-cleanup");

      expect(registry.getParentAgentIds("child-cleanup")).toContain("parent-cleanup");

      registry.removeAgent("parent-cleanup");

      expect(registry.getParentAgentIds("child-cleanup")).toEqual([]);
    });
  });

  describe("getParentAgentIds", () => {
    it("should track parent-child relationships", () => {
      const parentAgent1 = createMockAgent({ id: "relationship-parent-1" });
      const parentAgent2 = createMockAgent({ id: "relationship-parent-2" });
      const childAgent = createMockAgent({ id: "relationship-child" });

      registry.registerAgent(parentAgent1);
      registry.registerAgent(parentAgent2);
      registry.registerAgent(childAgent);
      registry.registerSubAgent("relationship-parent-1", "relationship-child");
      registry.registerSubAgent("relationship-parent-2", "relationship-child");

      const parentIds = registry.getParentAgentIds("relationship-child");
      expect(parentIds).toContain("relationship-parent-1");
      expect(parentIds).toContain("relationship-parent-2");
      expect(parentIds).toHaveLength(2);
    });

    it("should return empty array for agent with no parents", () => {
      const agent = createMockAgent({ id: "no-parents" });
      registry.registerAgent(agent);

      const parentIds = registry.getParentAgentIds("no-parents");
      expect(parentIds).toEqual([]);
    });

    it("should return empty array for non-existent agent", () => {
      const parentIds = registry.getParentAgentIds("non-existent");
      expect(parentIds).toEqual([]);
    });
  });

  describe("clear", () => {
    it("should remove all agents and relationships", () => {
      const agent1 = createMockAgent({ id: "clear-1" });
      const agent2 = createMockAgent({ id: "clear-2" });
      const child = createMockAgent({ id: "clear-child" });

      registry.registerAgent(agent1);
      registry.registerAgent(agent2);
      registry.registerAgent(child);
      registry.registerSubAgent("clear-1", "clear-child");

      expect(registry.getAgentCount()).toBe(3);
      expect(registry.getParentAgentIds("clear-child")).toContain("clear-1");

      registry.clear();

      expect(registry.getAgentCount()).toBe(0);
      expect(registry.getAllAgents()).toEqual([]);
      expect(registry.getParentAgentIds("clear-child")).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("should handle invalid agent registration gracefully", () => {
      expect(() => {
        registry.registerAgent(null as any);
      }).toThrow();
    });

    it("should handle undefined agent id", () => {
      const agentWithoutId = createMockAgent({ id: undefined as any });

      expect(() => {
        registry.registerAgent(agentWithoutId);
      }).toThrow();
    });

    it("should handle empty agent id", () => {
      const agentWithEmptyId = createMockAgent({ id: "" });

      expect(() => {
        registry.registerAgent(agentWithEmptyId);
      }).toThrow();
    });
  });
});
