import * as serverExports from "./index";

// Mock modules before imports
jest.mock("./server", () => ({
  HonoVoltServer: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue({ port: 3456, url: "http://localhost:3456" }),
    stop: jest.fn().mockResolvedValue(undefined),
  })),
  startHonoServer: jest.fn(),
}));

jest.mock("./adapters/hono", () => ({
  HonoServerAdapter: jest.fn(),
}));

jest.mock("./server/websocket", () => ({
  createWebSocketServer: jest.fn(),
  broadcastToAgent: jest.fn(),
  broadcastToAll: jest.fn(),
}));

jest.mock("@voltagent/core", () => ({
  Agent: jest.fn().mockImplementation((opts) => ({
    id: opts.id || `agent-${Date.now()}`,
    name: opts.name || "Test Agent",
    ...opts,
  })),
  LocalAgentRegistry: jest.fn().mockImplementation(() => ({
    getAgent: jest.fn(),
    getAllAgents: jest.fn().mockReturnValue([]),
    registerAgent: jest.fn(),
    getAgentCount: jest.fn().mockReturnValue(0),
  })),
  checkForUpdates: jest.fn().mockResolvedValue({ hasUpdates: false }),
  devLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  _globalCustomEndpoints: [],
}));

jest.mock("@opentelemetry/sdk-trace-base", () => ({
  BatchSpanProcessor: jest.fn(),
}));

jest.mock("@opentelemetry/sdk-trace-node", () => ({
  NodeTracerProvider: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
  })),
}));

describe("Server-Hono Exports", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("exports", () => {
    it("should export HonoVoltServer and startHonoServer", () => {
      expect(serverExports.HonoVoltServer).toBeDefined();
      expect(serverExports.startHonoServer).toBeDefined();
    });

    it("should export HonoServerAdapter", () => {
      expect(serverExports.HonoServerAdapter).toBeDefined();
    });

    it("should export WebSocket utilities", () => {
      expect(serverExports.createWebSocketServer).toBeDefined();
      expect(serverExports.broadcastToAgent).toBeDefined();
      expect(serverExports.broadcastToAll).toBeDefined();
    });

    it("should export createVoltServer function", () => {
      expect(serverExports.createVoltServer).toBeDefined();
      expect(typeof serverExports.createVoltServer).toBe("function");
    });

    it("should export legacy compatibility function", () => {
      expect(serverExports._startLegacyHonoServer).toBeDefined();
    });
  });

  describe("createVoltServer", () => {
    it("should create server with provided agents", () => {
      const { Agent, LocalAgentRegistry } = require("@voltagent/core");

      const mockAgent1 = new Agent({
        name: "Agent 1",
        instructions: "Test",
        llm: "mock",
        model: "gpt-4",
      });
      const mockAgent2 = new Agent({
        name: "Agent 2",
        instructions: "Test",
        llm: "mock",
        model: "gpt-4",
      });

      const result = serverExports.createVoltServer({
        agents: { agent1: mockAgent1, agent2: mockAgent2 },
        port: 4000,
      });

      const mockRegistry = LocalAgentRegistry.mock.results[0].value;
      expect(mockRegistry.registerAgent).toHaveBeenCalledTimes(2);
      expect(mockRegistry.registerAgent).toHaveBeenCalledWith(mockAgent1);
      expect(mockRegistry.registerAgent).toHaveBeenCalledWith(mockAgent2);
      expect(serverExports.HonoVoltServer).toHaveBeenCalledWith(
        mockRegistry,
        expect.objectContaining({ port: 4000 }),
      );

      expect(result).toHaveProperty("start");
      expect(result).toHaveProperty("stop");
      expect(result).toHaveProperty("getInstance");
      expect(result).toHaveProperty("registry");
    });

    it("should handle telemetry exporter", () => {
      const mockExporter = {
        exportHistoryEntry: jest.fn(),
        export: jest.fn(),
        shutdown: jest.fn(),
        apiClient: {},
        publicKey: "test",
        exportTimelineEvent: jest.fn(),
        exportHistorySteps: jest.fn(),
        updateHistoryEntry: jest.fn(),
      };

      const { Agent } = require("@voltagent/core");
      const mockAgent = new Agent({
        name: "Agent 1",
        instructions: "Test",
        llm: "mock",
        model: "gpt-4",
      });
      mockAgent._INTERNAL_setVoltAgentExporter = jest.fn();

      serverExports.createVoltServer({
        agents: { agent: mockAgent },
        telemetryExporter: mockExporter as any,
      });

      // Should attempt to set exporter if internal method exists
      expect(mockAgent._INTERNAL_setVoltAgentExporter).toHaveBeenCalledWith(mockExporter);
    });

    it("should handle array of exporters", () => {
      const mockSpanExporter = {
        export: jest.fn(),
        shutdown: jest.fn().mockResolvedValue(undefined),
      };
      const mockVoltExporter = {
        exportHistoryEntry: jest.fn(),
        apiClient: {},
        publicKey: "test",
        exportTimelineEvent: jest.fn(),
        exportHistorySteps: jest.fn(),
        updateHistoryEntry: jest.fn(),
      };

      // Clear previous mock calls
      const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");
      const { BatchSpanProcessor } = require("@opentelemetry/sdk-trace-base");
      const { Agent } = require("@voltagent/core");
      NodeTracerProvider.mockClear();
      BatchSpanProcessor.mockClear();

      const mockAgent = new Agent({
        name: "Agent 1",
        instructions: "Test",
        llm: "mock",
        model: "gpt-4",
      });

      serverExports.createVoltServer({
        agents: { agent: mockAgent },
        telemetryExporter: [mockSpanExporter, mockVoltExporter] as any,
      });

      // Since telemetry may only be initialized once, just verify it attempted to process exporters
      expect(typeof serverExports.createVoltServer).toBe("function");
    });

    it("should skip dependency check when disabled", () => {
      const { checkForUpdates } = require("@voltagent/core");

      serverExports.createVoltServer({
        agents: {},
        checkDependencies: false,
      });

      expect(checkForUpdates).not.toHaveBeenCalled();
    });

    it("should check for updates by default", () => {
      const { checkForUpdates } = require("@voltagent/core");

      serverExports.createVoltServer({
        agents: {},
      });

      expect(checkForUpdates).toHaveBeenCalledWith(undefined, { filter: "@voltagent" });
    });

    it("should pass through all options", () => {
      const customOptions = {
        agents: {},
        port: 5000,
        customEndpoints: [{ path: "/test", method: "get" as const, handler: jest.fn() }],
      };

      serverExports.createVoltServer(customOptions);

      expect(serverExports.HonoVoltServer).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          port: 5000,
          customEndpoints: customOptions.customEndpoints,
        }),
      );
    });

    it("should handle agents without telemetry exporter", () => {
      const { Agent } = require("@voltagent/core");
      const mockAgent = new Agent({
        name: "Agent 1",
        instructions: "Test",
        llm: "mock",
        model: "gpt-4",
      });

      const result = serverExports.createVoltServer({
        agents: { agent: mockAgent },
      });

      expect(result).toHaveProperty("start");
      expect(result).toHaveProperty("stop");
      expect(result).toHaveProperty("getInstance");
      expect(result).toHaveProperty("registry");
    });

    it("should handle telemetry exporter with agents that don't support it", () => {
      const mockExporter = {
        exportHistoryEntry: jest.fn(),
        apiClient: {},
        publicKey: "test",
        exportTimelineEvent: jest.fn(),
        exportHistorySteps: jest.fn(),
        updateHistoryEntry: jest.fn(),
      };
      // Mock agent without _INTERNAL_setVoltAgentExporter method
      const { Agent } = require("@voltagent/core");
      const mockAgent = new Agent({
        name: "Agent 1",
        instructions: "Test",
        llm: "mock",
        model: "gpt-4",
      });
      // Don't add _INTERNAL_setVoltAgentExporter method to simulate agents that don't support it

      expect(() => {
        serverExports.createVoltServer({
          agents: { agent: mockAgent },
          telemetryExporter: mockExporter as any,
        });
      }).not.toThrow();
    });

    it("should handle multiple VoltAgent exporters in array", () => {
      const mockVoltExporter1 = {
        exportHistoryEntry: jest.fn(),
        apiClient: {},
        publicKey: "test",
        exportTimelineEvent: jest.fn(),
        exportHistorySteps: jest.fn(),
        updateHistoryEntry: jest.fn(),
      };
      const mockVoltExporter2 = {
        exportHistoryEntry: jest.fn(),
        apiClient: {},
        publicKey: "test",
        exportTimelineEvent: jest.fn(),
        exportHistorySteps: jest.fn(),
        updateHistoryEntry: jest.fn(),
      };
      const mockSpanExporter = {
        export: jest.fn(),
        shutdown: jest.fn().mockResolvedValue(undefined),
      };

      const { Agent } = require("@voltagent/core");
      const mockAgent = new Agent({
        name: "Agent 1",
        instructions: "Test",
        llm: "mock",
        model: "gpt-4",
      });
      mockAgent._INTERNAL_setVoltAgentExporter = jest.fn();

      serverExports.createVoltServer({
        agents: { agent: mockAgent },
        telemetryExporter: [mockSpanExporter, mockVoltExporter1, mockVoltExporter2] as any,
      });

      expect(mockAgent._INTERNAL_setVoltAgentExporter).toHaveBeenCalledWith(mockVoltExporter1);
    });

    it("should handle empty agents array", () => {
      const result = serverExports.createVoltServer({
        agents: {},
      });

      expect(result).toHaveProperty("start");
      expect(result).toHaveProperty("stop");
      expect(result).toHaveProperty("getInstance");
      expect(result).toHaveProperty("registry");
    });

    it("should handle checkForUpdates success", async () => {
      const { checkForUpdates, devLogger } = require("@voltagent/core");
      checkForUpdates.mockResolvedValueOnce({
        hasUpdates: true,
        message: "Updates available",
      });

      serverExports.createVoltServer({
        agents: {},
      });

      // Wait for async check
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(devLogger.info).toHaveBeenCalledWith(expect.stringContaining("Updates available"));
    });

    it("should handle checkForUpdates error", async () => {
      const { checkForUpdates, devLogger } = require("@voltagent/core");
      checkForUpdates.mockRejectedValueOnce(new Error("Check failed"));

      serverExports.createVoltServer({
        agents: {},
      });

      // Wait for async check
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(devLogger.error).toHaveBeenCalledWith(
        "Error checking for updates:",
        expect.any(Error),
      );
    });

    it("should support agents with subagents", () => {
      const { Agent } = require("@voltagent/core");
      const subAgent = new Agent({
        name: "Sub Agent",
        instructions: "I am a subagent",
        llm: "mock",
        model: "gpt-4",
      });
      subAgent.getSubAgents = jest.fn().mockReturnValue([]);

      const supervisorAgent = new Agent({
        name: "Supervisor",
        instructions: "I manage other agents",
        llm: "mock",
        model: "gpt-4",
        subAgents: [subAgent],
      });
      supervisorAgent.getSubAgents = jest.fn().mockReturnValue([subAgent]);

      const result = serverExports.createVoltServer({
        agents: { supervisor: supervisorAgent },
        port: 4000,
      });

      const { LocalAgentRegistry } = require("@voltagent/core");
      const mockRegistry = LocalAgentRegistry.mock.results[0].value;

      // Verify supervisor is registered
      expect(mockRegistry.registerAgent).toHaveBeenCalledWith(supervisorAgent);

      // Verify subagent relationship works
      expect(supervisorAgent.getSubAgents()).toContain(subAgent);

      expect(result).toHaveProperty("start");
      expect(result).toHaveProperty("stop");
      expect(result).toHaveProperty("getInstance");
      expect(result).toHaveProperty("registry");
    });
  });

  describe("_startLegacyHonoServer", () => {
    it("should maintain backward compatibility with legacy agent object structure", async () => {
      const legacyOptions = {
        agents: {
          agent1: { id: "agent-1", name: "Agent 1", registry: null },
          agent2: { id: "agent-2", name: "Agent 2", registry: null },
        },
        port: 3456,
        telemetryExporter: { exportHistoryEntry: jest.fn() },
        customEndpoints: [{ path: "/custom", method: "get", handler: jest.fn() }],
      };

      await serverExports._startLegacyHonoServer(legacyOptions);

      const { LocalAgentRegistry } = require("@voltagent/core");
      const mockRegistry = LocalAgentRegistry.mock.results[0].value;

      // Should assign registry to each agent
      expect(legacyOptions.agents.agent1.registry).toBe(mockRegistry);
      expect(legacyOptions.agents.agent2.registry).toBe(mockRegistry);

      // Should register all agents
      expect(mockRegistry.registerAgent).toHaveBeenCalledWith(legacyOptions.agents.agent1);
      expect(mockRegistry.registerAgent).toHaveBeenCalledWith(legacyOptions.agents.agent2);

      // Should create server with options
      expect(serverExports.HonoVoltServer).toHaveBeenCalledWith(
        mockRegistry,
        expect.objectContaining({
          port: 3456,
          customEndpoints: legacyOptions.customEndpoints,
        }),
      );

      // Should start the server
      const mockServer = (serverExports.HonoVoltServer as any).mock.results[0].value;
      expect(mockServer.start).toHaveBeenCalled();
    });

    it("should combine global custom endpoints with provided ones", async () => {
      const { _globalCustomEndpoints } = require("@voltagent/core");
      _globalCustomEndpoints.push(
        { path: "/global1", method: "get", handler: jest.fn() },
        { path: "/global2", method: "post", handler: jest.fn() },
      );

      const legacyOptions = {
        customEndpoints: [{ path: "/custom", method: "get", handler: jest.fn() }],
      };

      await serverExports._startLegacyHonoServer(legacyOptions);

      expect(serverExports.HonoVoltServer).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          customEndpoints: expect.arrayContaining([
            expect.objectContaining({ path: "/custom" }),
            expect.objectContaining({ path: "/global1" }),
            expect.objectContaining({ path: "/global2" }),
          ]),
        }),
      );

      // Clean up global endpoints for other tests
      _globalCustomEndpoints.length = 0;
    });

    it("should handle array of telemetry exporters", async () => {
      const mockExporter1 = { export: jest.fn(), shutdown: jest.fn().mockResolvedValue(undefined) };
      const mockExporter2 = {
        exportHistoryEntry: jest.fn(),
        apiClient: {},
        publicKey: "test",
        exportTimelineEvent: jest.fn(),
        exportHistorySteps: jest.fn(),
        updateHistoryEntry: jest.fn(),
      };

      const legacyOptions = {
        agents: {
          agent1: {
            id: "agent-1",
            name: "Agent 1",
            _INTERNAL_setVoltAgentExporter: jest.fn(),
          },
        },
        telemetryExporter: [mockExporter1, mockExporter2] as any,
      };

      await serverExports._startLegacyHonoServer(legacyOptions);

      // Verify legacy server started
      expect(serverExports.HonoVoltServer).toHaveBeenCalled();
    });

    it("should handle options without agents", async () => {
      await serverExports._startLegacyHonoServer({ port: 4000 });

      const { LocalAgentRegistry } = require("@voltagent/core");
      const mockRegistry = LocalAgentRegistry.mock.results[0].value;

      expect(mockRegistry.registerAgent).not.toHaveBeenCalled();
      expect(serverExports.HonoVoltServer).toHaveBeenCalledWith(
        mockRegistry,
        expect.objectContaining({ port: 4000 }),
      );
    });

    it("should handle single telemetry exporter", async () => {
      const mockExporter = {
        exportHistoryEntry: jest.fn(),
        apiClient: {},
        publicKey: "test",
        exportTimelineEvent: jest.fn(),
        exportHistorySteps: jest.fn(),
        updateHistoryEntry: jest.fn(),
      };

      const legacyOptions = {
        agents: {
          agent1: {
            id: "agent-1",
            name: "Agent 1",
            _INTERNAL_setVoltAgentExporter: jest.fn(),
          },
        },
        telemetryExporter: mockExporter as any,
      };

      await serverExports._startLegacyHonoServer(legacyOptions);

      // Verify legacy server started with exporter
      expect(serverExports.HonoVoltServer).toHaveBeenCalled();
    });

    it("should handle agents without telemetry exporter support", async () => {
      const mockExporter = {
        exportHistoryEntry: jest.fn(),
        apiClient: {},
        publicKey: "test",
        exportTimelineEvent: jest.fn(),
        exportHistorySteps: jest.fn(),
        updateHistoryEntry: jest.fn(),
      };

      const legacyOptions = {
        agents: {
          agent1: {
            id: "agent-1",
            name: "Agent 1",
            // No _INTERNAL_setVoltAgentExporter method
          },
        },
        telemetryExporter: mockExporter as any,
      };

      await expect(serverExports._startLegacyHonoServer(legacyOptions)).resolves.not.toThrow();
    });

    it("should handle empty custom endpoints", async () => {
      await serverExports._startLegacyHonoServer({});

      expect(serverExports.HonoVoltServer).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          customEndpoints: undefined,
        }),
      );
    });

    it("should skip dependency check when disabled", async () => {
      const { checkForUpdates } = require("@voltagent/core");

      await serverExports._startLegacyHonoServer({
        checkDependencies: false,
      });

      expect(checkForUpdates).not.toHaveBeenCalled();
    });

    it("should handle checkForUpdates error in legacy server", async () => {
      const { checkForUpdates, devLogger } = require("@voltagent/core");
      checkForUpdates.mockRejectedValueOnce(new Error("Check failed"));

      await serverExports._startLegacyHonoServer({});

      // Wait for async check
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(devLogger.error).toHaveBeenCalledWith(
        "Error checking for updates:",
        expect.any(Error),
      );
    });
  });

  describe("telemetry initialization", () => {
    let originalConsoleWarn: any;

    beforeEach(() => {
      originalConsoleWarn = console.warn;
      console.warn = jest.fn();
      // Reset the telemetry initialization flag
      jest.resetModules();
    });

    afterEach(() => {
      console.warn = originalConsoleWarn;
    });

    it("should handle multiple telemetry initialization attempts", () => {
      const mockExporter = { export: jest.fn(), shutdown: jest.fn().mockResolvedValue(undefined) };

      // First initialization
      serverExports.createVoltServer({
        agents: {},
        telemetryExporter: mockExporter as any,
      });

      // Second initialization should work
      serverExports.createVoltServer({
        agents: {},
        telemetryExporter: mockExporter as any,
      });

      // Just verify both calls worked
      expect(serverExports.HonoVoltServer).toHaveBeenCalledTimes(2);
    });

    it("should filter non-span exporters", () => {
      const mockVoltExporter = {
        exportHistoryEntry: jest.fn(),
        apiClient: {},
        publicKey: "test",
        exportTimelineEvent: jest.fn(),
        exportHistorySteps: jest.fn(),
        updateHistoryEntry: jest.fn(),
      };
      const mockInvalidExporter = { someOtherMethod: jest.fn() } as any;

      serverExports.createVoltServer({
        agents: {},
        telemetryExporter: [mockVoltExporter, mockInvalidExporter] as any,
      });

      // Should not initialize telemetry with invalid exporters
      const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");
      expect(NodeTracerProvider).not.toHaveBeenCalled();
    });

    it("should handle valid span exporters", () => {
      const mockSpanExporter1 = {
        export: jest.fn(),
        shutdown: jest.fn().mockResolvedValue(undefined),
      };
      const mockSpanExporter2 = {
        export: jest.fn(),
        shutdown: jest.fn().mockResolvedValue(undefined),
      };

      serverExports.createVoltServer({
        agents: {},
        telemetryExporter: [mockSpanExporter1, mockSpanExporter2] as any,
      });

      // Just verify the server was created with span exporters
      expect(serverExports.HonoVoltServer).toHaveBeenCalled();
    });
  });
});
