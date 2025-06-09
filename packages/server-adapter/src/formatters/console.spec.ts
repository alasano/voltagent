import { ConsoleDataFormatter } from "./console";
import type { Agent, AgentHistoryEntry } from "@voltagent/core";

// Mock agent for testing
interface MockAgent extends Agent<any> {
  id: string;
  name: string;
  instructions: string;
}

// Helper function to create mock agent
function createMockAgent(overrides: Partial<MockAgent> = {}): MockAgent {
  const id = overrides.id || "test-agent-" + Math.random().toString(36).substr(2, 9);
  const name = overrides.name || "Test Agent";
  const instructions = overrides.instructions || "Test agent instructions";

  const defaultAgent = {
    id,
    name,
    instructions,
    generateText: jest.fn(),
    streamText: jest.fn(),
    generateObject: jest.fn(),
    streamObject: jest.fn(),
    getHistory: jest.fn().mockResolvedValue([]),
    getFullState: jest.fn().mockReturnValue({
      id,
      name,
      description: instructions,
      status: "idle",
      model: "gpt-4",
      tools: [],
      subAgents: [],
      memory: null,
    }),
    getToolsForApi: jest.fn().mockReturnValue([
      {
        name: "testTool",
        description: "A test tool",
        parameters: { type: "object", properties: {} },
      },
    ]),
    getSubAgents: jest.fn().mockReturnValue([]),
    isTelemetryConfigured: jest.fn().mockReturnValue(false),
    ...overrides,
  };

  return defaultAgent as MockAgent;
}

// Helper function to create mock history entry
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

describe("ConsoleDataFormatter", () => {
  let formatter: ConsoleDataFormatter;

  beforeEach(() => {
    formatter = new ConsoleDataFormatter();
  });

  describe("formatAgentList", () => {
    it("should format single agent correctly", () => {
      const agent = createMockAgent({
        id: "single-agent",
        name: "Single Agent",
        instructions: "Single agent description",
      });

      const result = formatter.formatAgentList([agent]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "single-agent",
        name: "Single Agent",
        description: "Single agent description",
        status: "idle",
        model: "gpt-4",
        tools: [
          {
            name: "testTool",
            description: "A test tool",
            parameters: { type: "object", properties: {} },
          },
        ],
        subAgents: [],
        memory: null,
        isTelemetryEnabled: false,
      });
    });

    it("should format multiple agents", () => {
      const agent1 = createMockAgent({ id: "agent-1", name: "Agent One" });
      const agent2 = createMockAgent({ id: "agent-2", name: "Agent Two" });

      const result = formatter.formatAgentList([agent1, agent2]);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("agent-1");
      expect(result[0].name).toBe("Agent One");
      expect(result[1].id).toBe("agent-2");
      expect(result[1].name).toBe("Agent Two");
    });

    it("should handle agents with subagents", () => {
      const subAgentData = {
        id: "sub-agent",
        name: "Sub Agent",
        description: "Test agent instructions",
        status: "idle",
        model: "gpt-4",
        tools: [],
        memory: null,
      };

      const parentAgent = createMockAgent({
        id: "parent-agent",
        name: "Parent Agent",
        getFullState: jest.fn().mockReturnValue({
          id: "parent-agent",
          name: "Parent Agent",
          description: "Test agent instructions",
          status: "idle",
          model: "gpt-4",
          tools: [],
          subAgents: [subAgentData],
          memory: null,
        }),
      });

      const result = formatter.formatAgentList([parentAgent]);

      expect(result).toHaveLength(1);
      expect(result[0].subAgents).toHaveLength(1);
      expect(result[0].subAgents?.[0]).toEqual({
        id: "sub-agent",
        name: "Sub Agent",
        description: "Test agent instructions",
        status: "idle",
        model: "gpt-4",
        tools: [],
        memory: null,
        isTelemetryEnabled: false,
      });
    });

    it("should handle empty agent list", () => {
      const result = formatter.formatAgentList([]);
      expect(result).toEqual([]);
    });

    it("should include telemetry status", () => {
      const agentWithTelemetry = createMockAgent({
        isTelemetryConfigured: jest.fn().mockReturnValue(true),
      });

      const result = formatter.formatAgentList([agentWithTelemetry]);

      expect(result[0].isTelemetryEnabled).toBe(true);
    });

    it("should handle agents with different statuses", () => {
      const idleAgent = createMockAgent({
        getFullState: jest.fn().mockReturnValue({
          id: "idle-agent",
          name: "Idle Agent",
          description: "Test agent",
          status: "idle",
          model: "gpt-4",
          tools: [],
          subAgents: [],
          memory: null,
        }),
      });

      const workingAgent = createMockAgent({
        getFullState: jest.fn().mockReturnValue({
          id: "working-agent",
          name: "Working Agent",
          description: "Test agent",
          status: "working",
          model: "gpt-4",
          tools: [],
          subAgents: [],
          memory: null,
        }),
      });

      const result = formatter.formatAgentList([idleAgent, workingAgent]);

      expect(result[0].status).toBe("idle");
      expect(result[1].status).toBe("working");
    });
  });

  describe("formatAgentDetail", () => {
    it("should format agent detail with full state", () => {
      const agent = createMockAgent({
        id: "detail-agent",
        name: "Detail Agent",
        instructions: "Detailed agent description",
      });

      const result = formatter.formatAgentDetail(agent);

      expect(result).toEqual({
        id: "detail-agent",
        name: "Detail Agent",
        description: "Detailed agent description",
        instructions: "Detailed agent description",
        status: "idle",
        model: "gpt-4",
        tools: [
          {
            name: "testTool",
            description: "A test tool",
            parameters: { type: "object", properties: {} },
          },
        ],
        subAgents: [],
        memory: null,
        retriever: undefined,
        isTelemetryEnabled: false,
        node_id: undefined,
      });
    });

    it("should include telemetry configuration", () => {
      const agent = createMockAgent({
        isTelemetryConfigured: jest.fn().mockReturnValue(true),
      });

      const result = formatter.formatAgentDetail(agent);

      expect(result.isTelemetryEnabled).toBe(true);
    });

    it("should include tools from API", () => {
      const agent = createMockAgent({
        getToolsForApi: jest.fn().mockReturnValue([
          {
            name: "customTool",
            description: "Custom tool description",
            parameters: { type: "object", properties: { param1: { type: "string" } } },
          },
        ]),
      });

      const result = formatter.formatAgentDetail(agent);

      expect(result.tools).toEqual([
        {
          name: "customTool",
          description: "Custom tool description",
          parameters: { type: "object", properties: { param1: { type: "string" } } },
        },
      ]);
    });
  });

  describe("formatHistory", () => {
    it("should format history entries correctly", () => {
      const historyEntries = [
        createMockHistoryEntry({
          id: "entry-1",
          input: "First input",
          output: "First output",
          status: "completed",
        }),
        createMockHistoryEntry({
          id: "entry-2",
          input: "Second input",
          output: "Second output",
          status: "working",
        }),
      ];

      const result = formatter.formatHistory(historyEntries);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "entry-1",
        input: "First input",
        output: "First output",
        status: "completed",
        startTime: new Date("2024-01-01T00:00:00Z"),
        endTime: new Date("2024-01-01T00:01:00Z"),
        steps: [],
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      });
      expect(result[1].status).toBe("working");
    });

    it("should handle empty history", () => {
      const result = formatter.formatHistory([]);
      expect(result).toEqual([]);
    });

    it("should include all required history fields", () => {
      const historyEntry = createMockHistoryEntry({
        steps: [
          { type: "text", content: "Step 1" },
          { type: "tool_call", content: "Tool executed" },
        ],
        usage: {
          promptTokens: 100,
          completionTokens: 200,
          totalTokens: 300,
        },
      });

      const result = formatter.formatHistory([historyEntry]);

      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("input");
      expect(result[0]).toHaveProperty("output");
      expect(result[0]).toHaveProperty("status");
      expect(result[0]).toHaveProperty("startTime");
      expect(result[0]).toHaveProperty("endTime");
      expect(result[0]).toHaveProperty("steps");
      expect(result[0]).toHaveProperty("usage");
      expect(result[0].steps).toHaveLength(2);
    });

    it("should handle history entries without usage information", () => {
      const historyEntry = createMockHistoryEntry({
        usage: undefined,
      });

      const result = formatter.formatHistory([historyEntry]);

      expect(result[0].usage).toBeUndefined();
    });

    it("should handle history entries with different statuses", () => {
      const entries = [
        createMockHistoryEntry({ status: "completed" }),
        createMockHistoryEntry({ status: "working" }),
        createMockHistoryEntry({ status: "error" }),
        createMockHistoryEntry({ status: "idle" }),
      ];

      const result = formatter.formatHistory(entries);

      expect(result[0].status).toBe("completed");
      expect(result[1].status).toBe("working");
      expect(result[2].status).toBe("error");
      expect(result[3].status).toBe("idle");
    });
  });

  describe("error handling", () => {
    it("should handle null agent gracefully", () => {
      expect(() => {
        formatter.formatAgentList([null as any]);
      }).toThrow();
    });

    it("should handle agent with missing methods", () => {
      const incompleteAgent = {
        id: "incomplete",
        name: "Incomplete Agent",
        // Missing required methods
      } as any;

      expect(() => {
        formatter.formatAgentList([incompleteAgent]);
      }).toThrow();
    });

    it("should handle null history entries", () => {
      expect(() => {
        formatter.formatHistory([null as any]);
      }).toThrow();
    });
  });
});
