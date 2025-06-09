import {
  getAgentsRoute,
  getAgentByIdRoute,
  getAgentHistoryRoute,
  getAgentCountRoute,
} from "./agent-routes";
import type { LocalAgentRegistry, AgentHistoryEntry } from "@voltagent/core";
import type { RouteContext } from "../../types";

// Local mock creation functions
function createMockAgent(overrides: any = {}): any {
  const id = overrides.id || "agent-" + Math.random().toString(36).substr(2, 9);
  const name = overrides.name || "Test Agent";
  const description = overrides.description || "Test agent description";

  return {
    id,
    name,
    instructions: description,
    generateText: jest.fn(),
    streamText: jest.fn(),
    generateObject: jest.fn(),
    streamObject: jest.fn(),
    getHistory: jest.fn().mockResolvedValue([]),
    getFullState: jest.fn().mockReturnValue({
      id,
      name,
      description,
      status: "idle",
      model: "gpt-4",
      tools: [],
      subAgents: [],
      memory: null,
      ...overrides.fullState,
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

function createMockRouteContext(overrides: any = {}): RouteContext {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    ...overrides,
  };
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

describe("Agent Routes", () => {
  let mockRegistry: jest.Mocked<LocalAgentRegistry>;
  let mockContext: RouteContext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegistry = createMockRegistry();
    mockContext = createMockRouteContext();
  });

  describe("getAgentsRoute", () => {
    it("should have correct route definition", () => {
      expect(getAgentsRoute.method).toBe("get");
      expect(getAgentsRoute.path).toBe("/agents");
      expect(getAgentsRoute.openapi).toBeDefined();
      expect(getAgentsRoute.openapi?.tags).toContain("Agent Management");
      expect(getAgentsRoute.openapi?.summary).toBe("List all agents");
    });

    it("should return list of agents", async () => {
      const agent1 = createMockAgent({
        id: "agent-1",
        name: "Agent One",
        description: "First test agent",
      });
      const agent2 = createMockAgent({
        id: "agent-2",
        name: "Agent Two",
        description: "Second test agent",
      });

      mockRegistry.getAllAgents.mockReturnValue([agent1, agent2]);

      const result = await getAgentsRoute.handler({}, mockContext, mockRegistry);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: "agent-1",
        name: "Agent One",
        description: "First test agent",
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
      expect(result[1]).toMatchObject({
        id: "agent-2",
        name: "Agent Two",
        description: "Second test agent",
      });
    });

    it("should return empty list when no agents", async () => {
      mockRegistry.getAllAgents.mockReturnValue([]);

      const result = await getAgentsRoute.handler({}, mockContext, mockRegistry);

      expect(result).toEqual([]);
      expect(mockRegistry.getAllAgents).toHaveBeenCalled();
    });

    it("should include sub-agents in response", async () => {
      const subAgentData = {
        id: "sub-agent-1",
        name: "Sub Agent",
        description: "Sub agent description",
        status: "working",
        model: "gpt-3.5",
        tools: [],
        memory: { context: "sub agent context" },
      };

      const parentAgent = createMockAgent({
        id: "parent-agent",
        fullState: {
          subAgents: [subAgentData],
        },
      });

      mockRegistry.getAllAgents.mockReturnValue([parentAgent]);

      const result = await getAgentsRoute.handler({}, mockContext, mockRegistry);

      expect(result).toHaveLength(1);
      expect(result[0].subAgents).toHaveLength(1);
      expect(result[0].subAgents[0]).toMatchObject({
        id: "sub-agent-1",
        name: "Sub Agent",
        description: "Sub agent description",
        status: "working",
        model: "gpt-3.5",
        tools: [],
        memory: { context: "sub agent context" },
      });
    });

    it("should handle agents with telemetry enabled", async () => {
      const agentWithTelemetry = createMockAgent({
        isTelemetryConfigured: jest.fn().mockReturnValue(true),
      });

      mockRegistry.getAllAgents.mockReturnValue([agentWithTelemetry]);

      const result = await getAgentsRoute.handler({}, mockContext, mockRegistry);

      expect(result[0].isTelemetryEnabled).toBe(true);
      expect(agentWithTelemetry.isTelemetryConfigured).toHaveBeenCalled();
    });

    it("should handle agents with different statuses", async () => {
      const idleAgent = createMockAgent({
        fullState: { status: "idle" },
      });
      const workingAgent = createMockAgent({
        fullState: { status: "working" },
      });
      const errorAgent = createMockAgent({
        fullState: { status: "error" },
      });

      mockRegistry.getAllAgents.mockReturnValue([idleAgent, workingAgent, errorAgent]);

      const result = await getAgentsRoute.handler({}, mockContext, mockRegistry);

      expect(result).toHaveLength(3);
      expect(result[0].status).toBe("idle");
      expect(result[1].status).toBe("working");
      expect(result[2].status).toBe("error");
    });

    it("should handle agents with complex tools", async () => {
      const agentWithTools = createMockAgent({
        getToolsForApi: jest.fn().mockReturnValue([
          {
            name: "calculator",
            description: "Math calculator tool",
            parameters: {
              type: "object",
              properties: {
                expression: { type: "string", description: "Math expression" },
              },
              required: ["expression"],
            },
          },
          {
            name: "weather",
            description: "Weather lookup tool",
            parameters: {
              type: "object",
              properties: {
                location: { type: "string" },
                units: { type: "string", enum: ["metric", "imperial"] },
              },
            },
          },
        ]),
      });

      mockRegistry.getAllAgents.mockReturnValue([agentWithTools]);

      const result = await getAgentsRoute.handler({}, mockContext, mockRegistry);

      expect(result[0].tools).toHaveLength(2);
      expect(result[0].tools[0].name).toBe("calculator");
      expect(result[0].tools[1].name).toBe("weather");
    });

    it("should handle sub-agents with missing optional fields", async () => {
      const incompleteSubAgent = {
        id: "incomplete-sub",
        // Missing optional fields
      };

      const parentAgent = createMockAgent({
        fullState: {
          subAgents: [incompleteSubAgent],
        },
      });

      mockRegistry.getAllAgents.mockReturnValue([parentAgent]);

      const result = await getAgentsRoute.handler({}, mockContext, mockRegistry);

      expect(result[0].subAgents[0]).toMatchObject({
        id: "incomplete-sub",
        name: "",
        description: "",
        status: "idle",
        model: "",
        tools: [],
        memory: undefined,
      });
    });
  });

  describe("getAgentByIdRoute", () => {
    it("should have correct route definition", () => {
      expect(getAgentByIdRoute.method).toBe("get");
      expect(getAgentByIdRoute.path).toBe("/agents/{id}");
      expect(getAgentByIdRoute.openapi).toBeDefined();
      expect(getAgentByIdRoute.openapi?.request?.params).toBeDefined();
    });

    it("should return agent details by ID", async () => {
      const agent = createMockAgent({
        id: "specific-agent",
        name: "Specific Agent",
        description: "Agent for ID lookup",
      });

      mockRegistry.getAgent.mockReturnValue(agent);

      const params = { id: "specific-agent" };
      const result = await getAgentByIdRoute.handler(params, mockContext, mockRegistry);

      expect(mockRegistry.getAgent).toHaveBeenCalledWith("specific-agent");
      expect(result).toMatchObject({
        id: "specific-agent",
        name: "Specific Agent",
        description: "Agent for ID lookup",
        status: "idle",
        model: "gpt-4",
        tools: expect.any(Array),
        subAgents: [],
        memory: null,
        isTelemetryEnabled: false,
      });
    });

    it("should throw error when agent not found", async () => {
      mockRegistry.getAgent.mockReturnValue(undefined);

      const params = { id: "non-existent-agent" };

      await expect(getAgentByIdRoute.handler(params, mockContext, mockRegistry)).rejects.toThrow(
        "Agent not found",
      );

      expect(mockRegistry.getAgent).toHaveBeenCalledWith("non-existent-agent");
    });

    it("should return agent with full telemetry information", async () => {
      const agentWithTelemetry = createMockAgent({
        id: "telemetry-agent",
        isTelemetryConfigured: jest.fn().mockReturnValue(true),
        fullState: {
          memory: {
            conversations: ["conv1", "conv2"],
            settings: { trackMetrics: true },
          },
        },
      });

      mockRegistry.getAgent.mockReturnValue(agentWithTelemetry);

      const params = { id: "telemetry-agent" };
      const result = await getAgentByIdRoute.handler(params, mockContext, mockRegistry);

      expect(result.isTelemetryEnabled).toBe(true);
      expect(result.memory).toEqual({
        conversations: ["conv1", "conv2"],
        settings: { trackMetrics: true },
      });
    });

    it("should handle agent with complex sub-agent hierarchy", async () => {
      const complexSubAgents = [
        {
          id: "sub-1",
          name: "First Sub Agent",
          description: "First level sub agent",
          status: "working",
          model: "claude-3",
          tools: [{ name: "tool1" }],
          memory: { depth: 1 },
        },
        {
          id: "sub-2",
          name: "Second Sub Agent",
          description: "Another sub agent",
          status: "idle",
          model: "gpt-3.5",
          tools: [],
          memory: null,
        },
      ];

      const complexAgent = createMockAgent({
        id: "complex-agent",
        fullState: {
          subAgents: complexSubAgents,
        },
      });

      mockRegistry.getAgent.mockReturnValue(complexAgent);

      const params = { id: "complex-agent" };
      const result = await getAgentByIdRoute.handler(params, mockContext, mockRegistry);

      expect(result.subAgents).toHaveLength(2);
      expect(result.subAgents[0]).toMatchObject({
        id: "sub-1",
        name: "First Sub Agent",
        status: "working",
        model: "claude-3",
        tools: [{ name: "tool1" }],
        memory: { depth: 1 },
      });
      expect(result.subAgents[1]).toMatchObject({
        id: "sub-2",
        name: "Second Sub Agent",
        status: "idle",
        model: "gpt-3.5",
        tools: [],
        memory: null,
      });
    });
  });

  describe("getAgentHistoryRoute", () => {
    it("should have correct route definition", () => {
      expect(getAgentHistoryRoute.method).toBe("get");
      expect(getAgentHistoryRoute.path).toBe("/agents/{id}/history");
      expect(getAgentHistoryRoute.openapi).toBeDefined();
      expect(getAgentHistoryRoute.openapi?.tags).toContain("Agent Management");
    });

    it("should return agent history", async () => {
      const agent = createMockAgent();
      const history = [
        createMockHistoryEntry({
          id: "history-1",
          input: "First question",
          output: "First response",
          status: "completed",
        }),
        createMockHistoryEntry({
          id: "history-2",
          input: "Second question",
          output: "Second response",
          status: "completed",
        }),
      ];

      agent.getHistory.mockResolvedValue(history);
      mockRegistry.getAgent.mockReturnValue(agent);

      const params = { id: "agent-with-history" };
      const result = await getAgentHistoryRoute.handler(params, mockContext, mockRegistry);

      expect(mockRegistry.getAgent).toHaveBeenCalledWith("agent-with-history");
      expect(agent.getHistory).toHaveBeenCalled();
      expect(result).toEqual(history);
      expect(result).toHaveLength(2);
    });

    it("should return empty history for agent with no history", async () => {
      const agent = createMockAgent();
      agent.getHistory.mockResolvedValue([]);
      mockRegistry.getAgent.mockReturnValue(agent);

      const params = { id: "agent-no-history" };
      const result = await getAgentHistoryRoute.handler(params, mockContext, mockRegistry);

      expect(result).toEqual([]);
      expect(agent.getHistory).toHaveBeenCalled();
    });

    it("should throw error when agent not found", async () => {
      mockRegistry.getAgent.mockReturnValue(undefined);

      const params = { id: "non-existent-agent" };

      await expect(getAgentHistoryRoute.handler(params, mockContext, mockRegistry)).rejects.toThrow(
        "Agent not found",
      );
    });

    it("should handle history with different entry types", async () => {
      const agent = createMockAgent();
      const mixedHistory = [
        createMockHistoryEntry({
          id: "text-entry",
          input: "Text input",
          output: "Text output",
          status: "completed",
        }),
        createMockHistoryEntry({
          id: "object-entry",
          input: { type: "object", data: "structured input" },
          output: "Structured output as string",
          status: "completed",
        }),
        createMockHistoryEntry({
          id: "error-entry",
          input: "Failed input",
          output: "Error message",
          status: "error",
        }),
      ];

      agent.getHistory.mockResolvedValue(mixedHistory);
      mockRegistry.getAgent.mockReturnValue(agent);

      const params = { id: "agent-mixed-history" };
      const result = await getAgentHistoryRoute.handler(params, mockContext, mockRegistry);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("text-entry");
      expect(result[1].id).toBe("object-entry");
      expect(result[2].status).toBe("error");
    });

    it("should handle history fetch errors", async () => {
      const agent = createMockAgent();
      agent.getHistory.mockRejectedValue(new Error("History fetch failed"));
      mockRegistry.getAgent.mockReturnValue(agent);

      const params = { id: "agent-history-error" };

      await expect(getAgentHistoryRoute.handler(params, mockContext, mockRegistry)).rejects.toThrow(
        "History fetch failed",
      );
    });

    it("should handle null history response", async () => {
      const agent = createMockAgent();
      agent.getHistory.mockResolvedValue(null);
      mockRegistry.getAgent.mockReturnValue(agent);

      const params = { id: "agent-null-history" };
      const result = await getAgentHistoryRoute.handler(params, mockContext, mockRegistry);

      expect(result).toBeNull();
    });
  });

  describe("getAgentCountRoute", () => {
    it("should have correct route definition", () => {
      expect(getAgentCountRoute.method).toBe("get");
      expect(getAgentCountRoute.path).toBe("/agents/count");
      expect(getAgentCountRoute.openapi).toBeDefined();
      expect(getAgentCountRoute.openapi?.summary).toBe("Get agent count");
    });

    it("should return agent count", async () => {
      mockRegistry.getAgentCount.mockReturnValue(5);

      const result = await getAgentCountRoute.handler({}, mockContext, mockRegistry);

      expect(mockRegistry.getAgentCount).toHaveBeenCalled();
      expect(result).toEqual({ count: 5 });
    });

    it("should return zero count when no agents", async () => {
      mockRegistry.getAgentCount.mockReturnValue(0);

      const result = await getAgentCountRoute.handler({}, mockContext, mockRegistry);

      expect(result).toEqual({ count: 0 });
    });

    it("should return large agent count", async () => {
      mockRegistry.getAgentCount.mockReturnValue(1000);

      const result = await getAgentCountRoute.handler({}, mockContext, mockRegistry);

      expect(result).toEqual({ count: 1000 });
    });

    it("should handle registry count errors", async () => {
      mockRegistry.getAgentCount.mockImplementation(() => {
        throw new Error("Registry error");
      });

      await expect(getAgentCountRoute.handler({}, mockContext, mockRegistry)).rejects.toThrow(
        "Registry error",
      );
    });
  });

  describe("Route OpenAPI schemas", () => {
    it("should have proper response schemas for getAgentsRoute", () => {
      const openapi = getAgentsRoute.openapi;
      expect(openapi?.responses).toBeDefined();
      expect(openapi?.responses[200]).toBeDefined();
      expect(openapi?.responses[500]).toBeDefined();
      expect(openapi?.responses[200].description).toBe("List of all registered agents");
    });

    it("should have proper error schemas for getAgentByIdRoute", () => {
      const openapi = getAgentByIdRoute.openapi;
      expect(openapi?.responses).toBeDefined();
      expect(openapi?.responses[200]).toBeDefined();
      expect(openapi?.responses[404]).toBeDefined();
      expect(openapi?.responses[404].description).toBe("Agent not found");
    });

    it("should have request parameter schema for routes with ID", () => {
      expect(getAgentByIdRoute.openapi?.request?.params).toBeDefined();
      expect(getAgentHistoryRoute.openapi?.request?.params).toBeDefined();
    });

    it("should have appropriate tags for all routes", () => {
      const routes = [getAgentsRoute, getAgentByIdRoute, getAgentHistoryRoute, getAgentCountRoute];

      routes.forEach((route) => {
        expect(route.openapi?.tags).toBeDefined();
        expect(route.openapi?.tags).toContain("Agent Management");
      });
    });

    it("should have summaries and descriptions", () => {
      const routes = [
        { route: getAgentsRoute, summary: "List all agents" },
        { route: getAgentByIdRoute, summary: "Get agent by ID" },
        { route: getAgentHistoryRoute, summary: "Get agent history" },
        { route: getAgentCountRoute, summary: "Get agent count" },
      ];

      routes.forEach(({ route, summary }) => {
        expect(route.openapi?.summary).toBe(summary);
        expect(route.openapi?.description).toBeDefined();
      });
    });
  });

  describe("Error handling scenarios", () => {
    it("should handle registry errors in getAgentsRoute", async () => {
      mockRegistry.getAllAgents.mockImplementation(() => {
        throw new Error("Registry connection failed");
      });

      await expect(getAgentsRoute.handler({}, mockContext, mockRegistry)).rejects.toThrow(
        "Registry connection failed",
      );
    });

    it("should handle agent state errors in getAgentByIdRoute", async () => {
      const agent = createMockAgent();
      agent.getFullState.mockImplementation(() => {
        throw new Error("State fetch failed");
      });
      mockRegistry.getAgent.mockReturnValue(agent);

      const params = { id: "error-agent" };

      await expect(getAgentByIdRoute.handler(params, mockContext, mockRegistry)).rejects.toThrow(
        "State fetch failed",
      );
    });

    it("should handle undefined agent in registry", async () => {
      mockRegistry.getAgent.mockReturnValue(undefined as any);

      const params = { id: "undefined-agent" };

      await expect(getAgentByIdRoute.handler(params, mockContext, mockRegistry)).rejects.toThrow(
        "Agent not found",
      );
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complete agent lifecycle", async () => {
      // Create agent
      const agent = createMockAgent({
        id: "lifecycle-agent",
        name: "Lifecycle Test Agent",
        fullState: {
          status: "working",
          subAgents: [
            {
              id: "sub-lifecycle",
              name: "Sub Agent",
              description: "Sub description",
              status: "idle",
              model: "gpt-3.5",
            },
          ],
        },
      });

      // Mock history
      const history = [
        createMockHistoryEntry({ id: "entry-1" }),
        createMockHistoryEntry({ id: "entry-2" }),
      ];
      agent.getHistory.mockResolvedValue(history);

      // Setup registry
      mockRegistry.getAllAgents.mockReturnValue([agent]);
      mockRegistry.getAgent.mockReturnValue(agent);
      mockRegistry.getAgentCount.mockReturnValue(1);

      // Test all routes
      const agentsList = await getAgentsRoute.handler({}, mockContext, mockRegistry);
      expect(agentsList).toHaveLength(1);

      const agentDetail = await getAgentByIdRoute.handler(
        { id: "lifecycle-agent" },
        mockContext,
        mockRegistry,
      );
      expect(agentDetail.id).toBe("lifecycle-agent");

      const agentHistory = await getAgentHistoryRoute.handler(
        { id: "lifecycle-agent" },
        mockContext,
        mockRegistry,
      );
      expect(agentHistory).toHaveLength(2);

      const count = await getAgentCountRoute.handler({}, mockContext, mockRegistry);
      expect(count.count).toBe(1);
    });

    it("should handle concurrent route calls", async () => {
      const agents = Array.from({ length: 3 }, (_, i) =>
        createMockAgent({ id: `agent-${i}`, name: `Agent ${i}` }),
      );

      mockRegistry.getAllAgents.mockReturnValue(agents);
      mockRegistry.getAgentCount.mockReturnValue(3);

      // Simulate concurrent calls
      const promises = [
        getAgentsRoute.handler({}, mockContext, mockRegistry),
        getAgentCountRoute.handler({}, mockContext, mockRegistry),
        getAgentsRoute.handler({}, mockContext, mockRegistry),
      ];

      const results = await Promise.all(promises);

      expect(results[0]).toHaveLength(3);
      expect(results[1].count).toBe(3);
      expect(results[2]).toHaveLength(3);
    });
  });
});
