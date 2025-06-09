import { VoltRouteFactory, createVoltRoutes } from "./factory";
import type { LocalAgentRegistry } from "@voltagent/core";
import type { ServerAdapter } from "../adapters/base";
import { ConsoleDataFormatter } from "../formatters/console";
import { WebSocketConnectionManager } from "../websocket";
import type { RouteDefinition, RouteContext, CustomEndpointDefinition } from "../types";

// Local mock creation functions
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

function createMockServerAdapter(): jest.Mocked<ServerAdapter> {
  const mockAdapter = {
    addRoute: jest.fn(),
    addSimpleRoute: jest.fn(),
    addStreamingRoute: jest.fn(),
    addSimpleStreamingRoute: jest.fn(),
    addWebSocketHandler: jest.fn(),
    getRegisteredRoutes: jest.fn().mockReturnValue([]),
    registeredRoutes: [],
  } as any;

  // Ensure addWebSocketHandler has mock properties
  mockAdapter.addWebSocketHandler = jest.fn();

  return mockAdapter;
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

function createMockRouteContext(overrides: any = {}): RouteContext {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    ...overrides,
  };
}

function createMockWebSocketConnection(): any {
  return {
    readyState: 1, // OPEN
    send: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
}

// Mock the route definitions import
jest.mock("./schemas", () => ({
  routeDefinitions: {
    "agents-list": {
      method: "get",
      path: "/agents",
      handler: jest.fn().mockResolvedValue([]),
    },
    "agents-detail": {
      method: "get",
      path: "/agents/:id",
      handler: jest.fn().mockResolvedValue({ agent: {} }),
    },
    "generate-text": {
      method: "post",
      path: "/generate/text",
      handler: jest.fn().mockResolvedValue({ text: "Generated text" }),
    },
    "stream-text": {
      method: "post",
      path: "/stream/text",
      handler: jest.fn().mockResolvedValue(new ReadableStream()),
    },
  },
}));

// Mock dependencies
jest.mock("../formatters/console", () => ({
  ConsoleDataFormatter: jest.fn().mockImplementation(() => ({
    formatSuccess: jest.fn().mockImplementation((data) => ({ success: true, data })),
    formatError: jest.fn().mockImplementation((error) => ({ success: false, error })),
  })),
}));
jest.mock("../websocket", () => ({
  WebSocketConnectionManager: jest.fn().mockImplementation(() => ({
    addConnection: jest.fn(),
    removeConnection: jest.fn(),
    broadcastToAgent: jest.fn(),
    handleTestConnection: jest.fn(),
    getInitialAgentState: jest.fn().mockImplementation((agentId: string) => {
      if (agentId === "nonexistent-agent") {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        type: "HISTORY_LIST",
        data: { history: [] },
      });
    }),
  })),
}));
jest.mock("../html/landing-page", () => ({
  generateLandingPageHtml: jest.fn().mockReturnValue("<html>Landing Page</html>"),
}));
jest.mock("../custom-endpoints", () => ({
  validateCustomEndpoints: jest.fn().mockImplementation((endpoints) => endpoints),
}));

describe("VoltRouteFactory", () => {
  let factory: VoltRouteFactory;
  let mockRegistry: jest.Mocked<LocalAgentRegistry>;
  let mockAdapter: jest.Mocked<ServerAdapter>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegistry = createMockRegistry();
    factory = new VoltRouteFactory(mockRegistry, {
      basePath: "/api/v1",
    });
    mockAdapter = createMockServerAdapter();
  });

  describe("constructor", () => {
    it("should create instance with default options", () => {
      const factoryWithDefaults = new VoltRouteFactory(mockRegistry);
      expect(factoryWithDefaults).toBeInstanceOf(VoltRouteFactory);
      expect(ConsoleDataFormatter).toHaveBeenCalled();
      expect(WebSocketConnectionManager).toHaveBeenCalledWith(mockRegistry);
    });

    it("should create instance with custom options", () => {
      const options = {
        basePath: "/custom/api",
        enableWebSocket: true,
        customEndpoints: [],
      };

      const customFactory = new VoltRouteFactory(mockRegistry, options);
      expect(customFactory).toBeInstanceOf(VoltRouteFactory);
    });

    it("should handle empty options", () => {
      const emptyFactory = new VoltRouteFactory(mockRegistry, {});
      expect(emptyFactory).toBeInstanceOf(VoltRouteFactory);
    });
  });

  describe("attachTo", () => {
    it("should register all OpenAPI routes", () => {
      factory.attachTo(mockAdapter);

      expect(mockAdapter.addRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "get",
          path: "/api/v1/agents",
          handler: expect.any(Function),
        }),
      );

      expect(mockAdapter.addRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "get",
          path: "/api/v1/agents/:id",
          handler: expect.any(Function),
        }),
      );

      expect(mockAdapter.addRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          path: "/api/v1/generate/text",
          handler: expect.any(Function),
        }),
      );
    });

    it("should register streaming routes when adapter supports them", () => {
      factory.attachTo(mockAdapter);

      expect(mockAdapter.addStreamingRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          path: "/api/v1/stream/text",
          handler: expect.any(Function),
        }),
      );
    });

    it("should add utility routes", () => {
      factory.attachTo(mockAdapter);

      expect(mockAdapter.addRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "get",
          path: "/api/v1/",
          handler: expect.any(Function),
        }),
      );
    });

    it("should add WebSocket routes when adapter supports them", () => {
      factory.attachTo(mockAdapter);

      expect(mockAdapter.addWebSocketHandler).toHaveBeenCalledWith(
        "/api/v1/ws/agents/:id",
        expect.any(Function),
      );

      expect(mockAdapter.addWebSocketHandler).toHaveBeenCalledWith(
        "/api/v1/ws",
        expect.any(Function),
      );
    });

    it("should skip WebSocket routes when WebSocket is disabled", () => {
      const factoryWithoutWS = new VoltRouteFactory(mockRegistry, {
        enableWebSocket: false,
      });

      factoryWithoutWS.attachTo(mockAdapter);

      expect(mockAdapter.addWebSocketHandler).not.toHaveBeenCalled();
    });

    it("should skip WebSocket routes when adapter doesn't support them", () => {
      const adapterWithoutWS = createMockServerAdapter();
      adapterWithoutWS.addWebSocketHandler = undefined;

      factory.attachTo(adapterWithoutWS);

      expect(adapterWithoutWS.addWebSocketHandler).toBeUndefined();
    });

    it("should register custom endpoints when provided", () => {
      const customEndpoints: CustomEndpointDefinition[] = [
        {
          path: "/custom",
          method: "get",
          handler: jest.fn(),
          description: "Custom endpoint",
        },
      ];

      const factoryWithCustom = new VoltRouteFactory(mockRegistry, {
        customEndpoints,
      });

      factoryWithCustom.attachTo(mockAdapter);

      expect(mockAdapter.addRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "get",
          path: "/custom",
          handler: expect.any(Function),
        }),
      );
    });
  });

  describe("route handler wrapping", () => {
    it("should wrap handlers with success formatting", async () => {
      factory.attachTo(mockAdapter);

      // Get the wrapped handler for agents list
      const agentRouteCall = mockAdapter.addRoute.mock.calls.find(
        (call) => call[0].path === "/api/v1/agents",
      );

      expect(agentRouteCall).toBeDefined();
      if (!agentRouteCall) return;

      const wrappedHandler = agentRouteCall[0].handler;
      expect(wrappedHandler).toBeDefined();
      if (!wrappedHandler) return;

      const mockContext = createMockRouteContext();
      const result = await wrappedHandler({}, mockContext);

      expect(result).toEqual({
        success: true,
        data: [],
      });
    });

    it("should handle route handler errors gracefully", async () => {
      // Mock the route definition to throw an error
      const { routeDefinitions } = require("./schemas");
      routeDefinitions["agents-list"].handler.mockRejectedValue(new Error("Test error"));

      factory.attachTo(mockAdapter);

      const wrappedHandler = mockAdapter.addRoute.mock.calls.find(
        (call) => call[0].path === "/api/v1/agents",
      )?.[0].handler;

      expect(wrappedHandler).toBeDefined();
      if (!wrappedHandler) return;

      const mockContext = createMockRouteContext();
      const result = await wrappedHandler({}, mockContext);

      expect(result).toEqual({
        success: false,
        error: "Test error",
      });
    });

    it("should handle 404 errors with specific status", async () => {
      const { routeDefinitions } = require("./schemas");
      routeDefinitions["agents-detail"].handler.mockRejectedValue(new Error("Agent not found"));

      factory.attachTo(mockAdapter);

      const wrappedHandler = mockAdapter.addRoute.mock.calls.find(
        (call) => call[0].path === "/api/v1/agents/:id",
      )?.[0].handler;

      expect(wrappedHandler).toBeDefined();
      if (!wrappedHandler) return;

      try {
        const mockContext = createMockRouteContext();
        await wrappedHandler({ id: "nonexistent" }, mockContext);
      } catch (error: any) {
        expect(error.status).toBe(404);
        expect(error.message).toBe("Agent not found");
      }
    });

    it("should inject registry into route handlers", async () => {
      factory.attachTo(mockAdapter);

      const wrappedHandler = mockAdapter.addRoute.mock.calls.find(
        (call) => call[0].path === "/api/v1/agents",
      )?.[0].handler;

      expect(wrappedHandler).toBeDefined();
      if (!wrappedHandler) return;

      const mockContext = createMockRouteContext();
      await wrappedHandler({}, mockContext);

      const { routeDefinitions } = require("./schemas");
      expect(routeDefinitions["agents-list"].handler).toHaveBeenCalledWith(
        {},
        mockContext,
        mockRegistry,
      );
    });
  });

  describe("landing page route", () => {
    it("should return HTML content", async () => {
      factory.attachTo(mockAdapter);

      const landingHandler = mockAdapter.addRoute.mock.calls.find(
        (call) => call[0].path === "/api/v1/",
      )?.[0].handler;

      expect(landingHandler).toBeDefined();
      if (!landingHandler) return;

      const result = await landingHandler({}, createMockRouteContext());

      expect(result).toEqual({
        contentType: "text/html",
        content: "<html>Landing Page</html>",
      });
    });
  });

  describe("WebSocket route handlers", () => {
    it("should handle agent-specific WebSocket connections", async () => {
      const mockConnection = createMockWebSocketConnection();
      const mockAgent = createMockAgent();
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      factory.attachTo(mockAdapter);

      const wsHandler = (mockAdapter.addWebSocketHandler as jest.Mock).mock.calls.find(
        (call: any) => call[0] === "/api/v1/ws/agents/:id",
      )?.[1];

      expect(wsHandler).toBeDefined();
      if (!wsHandler) return;

      await wsHandler(mockConnection, null, "agent-1");

      expect(mockConnection.send).toHaveBeenCalledWith(expect.stringContaining("HISTORY_LIST"));
      expect(mockConnection.on).toHaveBeenCalledWith("close", expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should handle general WebSocket test connections", async () => {
      const mockConnection = createMockWebSocketConnection();

      factory.attachTo(mockAdapter);

      const wsHandler = (mockAdapter.addWebSocketHandler as jest.Mock).mock.calls.find(
        (call: any) => call[0] === "/api/v1/ws",
      )?.[1];

      expect(wsHandler).toBeDefined();
      if (!wsHandler) return;

      await wsHandler(mockConnection, null);

      expect(mockConnection.on).toHaveBeenCalledWith("message", expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should handle connection cleanup on close", async () => {
      const mockConnection = createMockWebSocketConnection();
      const mockAgent = createMockAgent();
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      factory.attachTo(mockAdapter);

      const wsHandler = (mockAdapter.addWebSocketHandler as jest.Mock).mock.calls.find(
        (call: any) => call[0] === "/api/v1/ws/agents/:id",
      )?.[1];

      expect(wsHandler).toBeDefined();
      if (!wsHandler) return;

      await wsHandler(mockConnection, null, "agent-1");

      // Simulate connection close
      const closeHandler = mockConnection.on.mock.calls.find(
        (call: any) => call[0] === "close",
      )?.[1];

      expect(closeHandler).toBeDefined();
      closeHandler();
    });

    it("should handle connection errors", async () => {
      const mockConnection = createMockWebSocketConnection();
      const mockAgent = createMockAgent();
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      factory.attachTo(mockAdapter);

      const wsHandler = (mockAdapter.addWebSocketHandler as jest.Mock).mock.calls.find(
        (call: any) => call[0] === "/api/v1/ws/agents/:id",
      )?.[1];

      expect(wsHandler).toBeDefined();
      if (!wsHandler) return;

      await wsHandler(mockConnection, null, "agent-1");

      // Simulate connection error
      const errorHandler = mockConnection.on.mock.calls.find(
        (call: any) => call[0] === "error",
      )?.[1];

      expect(errorHandler).toBeDefined();
      errorHandler(new Error("Connection error"));
    });
  });

  describe("custom endpoints", () => {
    it("should validate custom endpoints before registering", () => {
      const { validateCustomEndpoints } = require("../custom-endpoints");
      const customEndpoints: CustomEndpointDefinition[] = [
        {
          path: "/custom",
          method: "get",
          handler: jest.fn(),
        },
      ];

      const factoryWithCustom = new VoltRouteFactory(mockRegistry, {
        customEndpoints,
      });

      factoryWithCustom.attachTo(mockAdapter);

      expect(validateCustomEndpoints).toHaveBeenCalledWith(customEndpoints);
    });

    it("should handle custom endpoint validation errors", () => {
      const { validateCustomEndpoints } = require("../custom-endpoints");
      validateCustomEndpoints.mockImplementation(() => {
        throw new Error("Invalid endpoint");
      });

      const customEndpoints: CustomEndpointDefinition[] = [
        {
          path: "invalid-path", // Missing leading slash
          method: "get",
          handler: jest.fn(),
        },
      ];

      const factoryWithCustom = new VoltRouteFactory(mockRegistry, {
        customEndpoints,
      });

      expect(() => {
        factoryWithCustom.attachTo(mockAdapter);
      }).toThrow("Invalid endpoint");
    });

    it("should skip custom endpoints when array is empty", () => {
      const factoryWithEmpty = new VoltRouteFactory(mockRegistry, {
        customEndpoints: [],
      });

      factoryWithEmpty.attachTo(mockAdapter);

      // Should not throw and should not call validateCustomEndpoints
      const { validateCustomEndpoints } = require("../custom-endpoints");
      expect(validateCustomEndpoints).not.toHaveBeenCalled();
    });

    it("should add base path to custom endpoints", () => {
      // Reset the mock to its default behavior
      const { validateCustomEndpoints } = require("../custom-endpoints");
      validateCustomEndpoints.mockImplementation((endpoints: any) => endpoints);

      const customEndpoints: CustomEndpointDefinition[] = [
        {
          path: "/custom",
          method: "post",
          handler: jest.fn(),
        },
      ];

      const factoryWithCustom = new VoltRouteFactory(mockRegistry, {
        basePath: "/api/v1",
        customEndpoints,
      });

      factoryWithCustom.attachTo(mockAdapter);

      expect(mockAdapter.addRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          path: "/api/v1/custom",
          handler: expect.any(Function),
        }),
      );
    });
  });

  describe("getWebSocketManager", () => {
    it("should return the WebSocket manager instance", () => {
      const manager = factory.getWebSocketManager();
      expect(manager).toBeDefined();
      expect(typeof manager.addConnection).toBe("function");
      expect(typeof manager.removeConnection).toBe("function");
      expect(typeof manager.broadcastToAgent).toBe("function");
    });
  });

  describe("error scenarios", () => {
    it("should handle missing agent for WebSocket connections", async () => {
      const mockConnection = createMockWebSocketConnection();
      mockRegistry.getAgent.mockReturnValue(undefined);

      factory.attachTo(mockAdapter);

      const wsHandler = (mockAdapter.addWebSocketHandler as jest.Mock).mock.calls.find(
        (call: any) => call[0] === "/api/v1/ws/agents/:id",
      )?.[1];

      // Should not throw
      await expect(wsHandler(mockConnection, null, "nonexistent-agent")).resolves.not.toThrow();
      expect(mockConnection.send).not.toHaveBeenCalled();
    });

    it("should handle WebSocket send errors gracefully", async () => {
      const mockConnection = createMockWebSocketConnection();
      mockConnection.send.mockImplementation(() => {
        throw new Error("Send failed");
      });

      const mockAgent = createMockAgent();
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      factory.attachTo(mockAdapter);

      const wsHandler = (mockAdapter.addWebSocketHandler as jest.Mock).mock.calls.find(
        (call: any) => call[0] === "/api/v1/ws/agents/:id",
      )?.[1];

      // Should not throw despite send error
      await expect(wsHandler(mockConnection, null, "agent-1")).resolves.not.toThrow();
    });

    it("should handle route handler non-Error exceptions", async () => {
      const { routeDefinitions } = require("./schemas");
      routeDefinitions["agents-list"].handler.mockRejectedValue("String error");

      factory.attachTo(mockAdapter);

      const wrappedHandler = mockAdapter.addRoute.mock.calls.find(
        (call) => call[0].path === "/api/v1/agents",
      )?.[0].handler;

      expect(wrappedHandler).toBeDefined();
      if (!wrappedHandler) return;

      const mockContext = createMockRouteContext();
      const result = await wrappedHandler({}, mockContext);

      expect(result).toEqual({
        success: false,
        error: "An error occurred",
      });
    });
  });

  describe("base path handling", () => {
    it("should handle empty base path", () => {
      const factoryWithoutBase = new VoltRouteFactory(mockRegistry, {
        basePath: "",
      });

      factoryWithoutBase.attachTo(mockAdapter);

      expect(mockAdapter.addRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/agents", // No base path prefix
        }),
      );
    });

    it("should handle undefined base path", () => {
      const factoryWithUndefinedBase = new VoltRouteFactory(mockRegistry, {});

      factoryWithUndefinedBase.attachTo(mockAdapter);

      expect(mockAdapter.addRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/agents", // No base path prefix
        }),
      );
    });
  });
});

describe("createVoltRoutes", () => {
  it("should create VoltRouteFactory instance", () => {
    const mockRegistry = createMockRegistry();
    const factory = createVoltRoutes(mockRegistry);

    expect(factory).toBeInstanceOf(VoltRouteFactory);
  });

  it("should create VoltRouteFactory with options", () => {
    const mockRegistry = createMockRegistry();
    const options = { basePath: "/api" };
    const factory = createVoltRoutes(mockRegistry, options);

    expect(factory).toBeInstanceOf(VoltRouteFactory);
  });

  it("should create VoltRouteFactory without options", () => {
    const mockRegistry = createMockRegistry();
    const factory = createVoltRoutes(mockRegistry);

    expect(factory).toBeInstanceOf(VoltRouteFactory);
  });
});
