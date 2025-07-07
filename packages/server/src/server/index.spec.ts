import { HonoVoltServer, startHonoServer } from "./index";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Server } from "node:http";
import type { LocalAgentRegistry } from "@voltagent/core";

// Store the original before mocking
const OriginalHonoVoltServer = HonoVoltServer;

// Mock dependencies
jest.mock("@hono/node-server", () => ({
  serve: jest.fn(() => ({
    port: 3456,
    close: jest.fn(),
    addListener: jest.fn(),
  })),
}));

const mockApp = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  options: jest.fn(),
  head: jest.fn(),
  use: jest.fn(),
  doc: jest.fn(),
  fetch: jest.fn(),
};

jest.mock("@hono/zod-openapi", () => ({
  OpenAPIHono: jest.fn().mockImplementation(() => mockApp),
}));

jest.mock("@hono/swagger-ui", () => ({
  swaggerUI: jest.fn(() => jest.fn()),
}));

jest.mock("@voltagent/server-adapter", () => ({
  createVoltRoutes: jest.fn(() => ({
    attachTo: jest.fn(),
    getWebSocketManager: jest.fn(() => ({
      handleTestConnection: jest.fn(),
      addConnection: jest.fn(),
      removeConnection: jest.fn(),
      getInitialAgentState: jest.fn().mockResolvedValue({ type: "INITIAL_STATE" }),
    })),
  })),
  extractAgentIdFromUrl: jest.fn((url) => {
    const match = url.match(/\/ws\/agents\/([^\/]+)/);
    return match ? match[1] : null;
  }),
  isTestWebSocketUrl: jest.fn((url) => url === "/ws"),
}));

jest.mock("../adapters/hono", () => ({
  HonoServerAdapter: jest.fn().mockImplementation(() => ({
    app: new (require("@hono/zod-openapi").OpenAPIHono)(),
    addRoute: jest.fn(),
    addStreamingRoute: jest.fn(),
    addWebSocketHandler: jest.fn(),
    getRegisteredRoutes: jest.fn().mockReturnValue([]),
  })),
}));

jest.mock("./websocket", () => ({
  createWebSocketServer: jest.fn(() => ({
    on: jest.fn(),
    handleUpgrade: jest.fn(),
    emit: jest.fn(),
    close: jest.fn(),
  })),
}));

jest.mock("get-port", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(3456),
}));

// Local mock creation functions
function createMockRegistry(): any {
  return {
    getAgent: jest.fn(),
    getAllAgents: jest.fn().mockReturnValue([]),
    getAgentCount: jest.fn().mockReturnValue(0),
    registerAgent: jest.fn(),
  };
}

// Mock console methods for logging verification
function mockConsoleMethods() {
  return {
    log: jest.spyOn(console, "log").mockImplementation(),
    error: jest.spyOn(console, "error").mockImplementation(),
    warn: jest.spyOn(console, "warn").mockImplementation(),
  };
}

describe("HonoVoltServer", () => {
  let server: HonoVoltServer;
  let mockRegistry: any;
  let consoleMocks: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRegistry = createMockRegistry();
    consoleMocks = mockConsoleMethods();

    server = new HonoVoltServer(mockRegistry, {
      port: 3456,
      basePath: "/api/v1",
    });
  });

  afterEach(() => {
    // Restore console mocks
    consoleMocks.log.mockRestore();
    consoleMocks.error.mockRestore();
    consoleMocks.warn.mockRestore();
  });

  describe("constructor", () => {
    it("should initialize with default options", () => {
      const basicServer = new HonoVoltServer(mockRegistry);
      expect(basicServer).toBeDefined();
    });

    it("should initialize with custom port", () => {
      const customServer = new HonoVoltServer(mockRegistry, { port: 8080 });
      expect(customServer).toBeDefined();
    });

    it("should setup OpenAPIHono app", () => {
      expect(OpenAPIHono).toHaveBeenCalled();
    });

    it("should setup HonoServerAdapter", () => {
      const { HonoServerAdapter } = require("../adapters/hono");
      expect(HonoServerAdapter).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  describe("start", () => {
    it("should start server on available port", async () => {
      const result = await server.start();

      expect(result).toEqual(
        expect.objectContaining({
          port: 3456,
          app: expect.any(Object),
          server: expect.any(Object),
          ws: expect.any(Object),
        }),
      );

      const { serve } = require("@hono/node-server");
      expect(serve).toHaveBeenCalledWith(
        expect.objectContaining({
          fetch: expect.any(Function),
          port: 3456,
          hostname: "0.0.0.0",
        }),
      );
    });

    it("should create VoltRoutes and attach to adapter", async () => {
      await server.start();

      const { createVoltRoutes } = require("@voltagent/server-adapter");
      expect(createVoltRoutes).toHaveBeenCalledWith(
        mockRegistry,
        expect.objectContaining({
          basePath: "/api/v1",
        }),
      );
    });

    it("should setup WebSocket server", async () => {
      await server.start();

      const { createWebSocketServer } = require("./websocket");
      expect(createWebSocketServer).toHaveBeenCalledWith(mockRegistry);
    });

    it("should setup WebSocket upgrade handler", async () => {
      await server.start();

      const { serve } = require("@hono/node-server");
      const mockServer = serve.mock.results[0].value;

      expect(mockServer.addListener).toHaveBeenCalledWith("upgrade", expect.any(Function));
    });

    it("should display startup messages", async () => {
      mockRegistry.getAgentCount.mockReturnValue(2);

      await server.start();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("VOLTAGENT SERVER STARTED"));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("http://localhost:3456"));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("2 registered"));
    });

    it("should return existing server info if already started", async () => {
      const firstResult = await server.start();
      const secondResult = await server.start();

      expect(firstResult).toBe(secondResult);
      expect(console.log).toHaveBeenCalledWith("Server is already running");
    });

    it("should use custom hostname when provided", async () => {
      const customServer = new HonoVoltServer(mockRegistry, { hostname: "127.0.0.1" });
      await customServer.start();

      const { serve } = require("@hono/node-server");
      expect(serve).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: "127.0.0.1",
        }),
      );
    });
  });

  describe("WebSocket upgrade handling", () => {
    it("should handle WebSocket upgrade requests", async () => {
      await server.start();

      const { serve } = require("@hono/node-server");
      const mockServer = serve.mock.results[0].value;
      const upgradeHandler = mockServer.addListener.mock.calls.find(
        (call: any) => call[0] === "upgrade",
      )?.[1];

      expect(upgradeHandler).toBeDefined();

      // Mock WebSocket upgrade
      const mockReq = { url: "/ws/agents/test-agent" };
      const mockSocket = {};
      const mockHead = Buffer.from("");

      const { createWebSocketServer } = require("./websocket");
      const mockWss = createWebSocketServer.mock.results[0].value;

      upgradeHandler(mockReq, mockSocket, mockHead);

      expect(mockWss.handleUpgrade).toHaveBeenCalledWith(
        mockReq,
        mockSocket,
        mockHead,
        expect.any(Function),
      );
    });

    it("should handle test WebSocket connections", async () => {
      await server.start();

      const { serve } = require("@hono/node-server");
      const mockServer = serve.mock.results[0].value;
      const upgradeHandler = mockServer.addListener.mock.calls.find(
        (call: any) => call[0] === "upgrade",
      )?.[1];

      const mockReq = { url: "/ws" };
      const mockSocket = {};
      const mockHead = Buffer.from("");

      const { createWebSocketServer } = require("./websocket");
      const mockWss = createWebSocketServer.mock.results[0].value;
      const mockWebSocket = { send: jest.fn(), on: jest.fn() };

      // Mock the callback
      mockWss.handleUpgrade.mockImplementation(
        (req: any, socket: any, head: any, callback: any) => {
          callback(mockWebSocket);
        },
      );

      upgradeHandler(mockReq, mockSocket, mockHead);

      expect(mockWss.emit).toHaveBeenCalledWith("connection", mockWebSocket, mockReq);
    });

    it("should handle agent-specific WebSocket connections", async () => {
      await server.start();

      const { serve } = require("@hono/node-server");
      const mockServer = serve.mock.results[0].value;
      const upgradeHandler = mockServer.addListener.mock.calls.find(
        (call: any) => call[0] === "upgrade",
      )?.[1];

      const mockReq = { url: "/ws/agents/test-agent-123" };
      const mockSocket = {};
      const mockHead = Buffer.from("");

      const { createWebSocketServer } = require("./websocket");
      const mockWss = createWebSocketServer.mock.results[0].value;
      const mockWebSocket = { send: jest.fn(), on: jest.fn() };

      // Mock the callback
      mockWss.handleUpgrade.mockImplementation(
        (req: any, socket: any, head: any, callback: any) => {
          callback(mockWebSocket);
        },
      );

      upgradeHandler(mockReq, mockSocket, mockHead);

      // Verify the basic upgrade handling worked
      expect(mockWss.handleUpgrade).toHaveBeenCalled();
    });

    it("should destroy socket for non-WebSocket URLs", async () => {
      await server.start();

      const { serve } = require("@hono/node-server");
      const mockServer = serve.mock.results[0].value;
      const upgradeHandler = mockServer.addListener.mock.calls.find(
        (call: any) => call[0] === "upgrade",
      )?.[1];

      const mockReq = { url: "/api/agents" };
      const mockSocket = { destroy: jest.fn() };
      const mockHead = Buffer.from("");

      upgradeHandler(mockReq, mockSocket, mockHead);

      expect(mockSocket.destroy).toHaveBeenCalled();
    });
  });

  describe("stop", () => {
    it("should stop running server", async () => {
      await server.start();
      await server.stop();

      const serverInfo = server.getServerInfo();
      expect(serverInfo).toBeUndefined();
    });

    it("should close WebSocket server on stop", async () => {
      await server.start();

      const { createWebSocketServer } = require("./websocket");
      const mockWss = createWebSocketServer.mock.results[0].value;

      await server.stop();

      expect(mockWss.close).toHaveBeenCalled();
    });

    it("should handle stop when server not running", async () => {
      await expect(server.stop()).resolves.not.toThrow();
    });
  });

  describe("landing page", () => {
    it("should setup landing page route", async () => {
      await server.start();

      expect(mockApp.get).toHaveBeenCalledWith("/", expect.any(Function));
    });

    it("should serve HTML landing page", async () => {
      await server.start();

      const landingHandler = mockApp.get.mock.calls.find((call: any) => call[0] === "/")?.[1];
      const mockContext = { html: jest.fn() };

      if (landingHandler) {
        landingHandler(mockContext);
        expect(mockContext.html).toHaveBeenCalledWith(expect.stringContaining("VoltAgent"));
      } else {
        expect(mockApp.get).toHaveBeenCalledWith("/", expect.any(Function));
      }
    });
  });

  describe("OpenAPI documentation", () => {
    it("should setup OpenAPI documentation endpoints", async () => {
      await server.start();

      expect(mockApp.doc).toHaveBeenCalledWith(
        "/doc",
        expect.objectContaining({
          openapi: "3.1.0",
          info: expect.objectContaining({
            title: "VoltAgent Server API",
            version: "2.0.0",
          }),
        }),
      );
    });

    it("should setup Swagger UI endpoint", async () => {
      const { swaggerUI } = require("@hono/swagger-ui");

      await server.start();

      expect(swaggerUI).toHaveBeenCalledWith({ url: "/doc" });
      expect(mockApp.get).toHaveBeenCalledWith("/ui", expect.any(Function));
    });
  });

  describe("port selection", () => {
    it("should use preferred port if specified", async () => {
      const customServer = new HonoVoltServer(mockRegistry, { port: 4000 });
      await customServer.start();

      const { serve } = require("@hono/node-server");
      expect(serve).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 4000,
        }),
      );
    });

    it("should use preferred ports array", async () => {
      const customServer = new HonoVoltServer(mockRegistry, {
        port: 3000,
        preferredPorts: [3000, 3001, 3002],
      });

      await customServer.start();

      // Port should be from the findAvailablePort logic
      const { serve } = require("@hono/node-server");
      expect(serve).toHaveBeenCalledWith(
        expect.objectContaining({
          port: expect.any(Number),
        }),
      );
    });
  });

  describe("custom endpoints", () => {
    it("should pass custom endpoints to VoltRoutes", async () => {
      const customEndpoints = [
        {
          path: "/custom",
          method: "get" as const,
          handler: jest.fn(),
        },
      ];

      const customServer = new HonoVoltServer(mockRegistry, {
        customEndpoints,
      });

      await customServer.start();

      const { createVoltRoutes } = require("@voltagent/server-adapter");
      expect(createVoltRoutes).toHaveBeenCalledWith(
        mockRegistry,
        expect.objectContaining({
          customEndpoints,
        }),
      );
    });
  });

  describe("getServerInfo", () => {
    it("should return server information when running", async () => {
      const result = await server.start();
      const info = server.getServerInfo();

      expect(info).toBe(result);
      expect(info).toEqual(
        expect.objectContaining({
          port: expect.any(Number),
          app: expect.any(Object),
          server: expect.any(Object),
          ws: expect.any(Object),
        }),
      );
    });

    it("should return undefined when not running", () => {
      const info = server.getServerInfo();
      expect(info).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should handle WebSocket manager errors gracefully", async () => {
      await server.start();

      const { serve } = require("@hono/node-server");
      const mockServer = serve.mock.results[0].value;
      const upgradeHandler = mockServer.addListener.mock.calls.find(
        (call: any) => call[0] === "upgrade",
      )?.[1];

      const mockReq = { url: "/ws/agents/test-agent" };
      const mockSocket = {};
      const mockHead = Buffer.from("");

      const { createWebSocketServer } = require("./websocket");
      const mockWss = createWebSocketServer.mock.results[0].value;
      const mockWebSocket = { send: jest.fn(), on: jest.fn() };

      mockWss.handleUpgrade.mockImplementation(
        (req: any, socket: any, head: any, callback: any) => {
          callback(mockWebSocket);
        },
      );

      upgradeHandler(mockReq, mockSocket, mockHead);

      // Verify the upgrade handler worked
      expect(mockWss.handleUpgrade).toHaveBeenCalled();
    });

    it("should handle WebSocket connection errors", async () => {
      await server.start();

      const { serve } = require("@hono/node-server");
      const mockServer = serve.mock.results[0].value;
      const upgradeHandler = mockServer.addListener.mock.calls.find(
        (call: any) => call[0] === "upgrade",
      )?.[1];

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const mockReq = { url: "/ws/agents/test-agent" };
      const mockSocket = {};
      const mockHead = Buffer.from("");

      const { createWebSocketServer } = require("./websocket");
      const mockWss = createWebSocketServer.mock.results[0].value;
      const mockWebSocket = {
        send: jest.fn(),
        on: jest.fn((event, handler) => {
          if (event === "error") {
            // Simulate error
            setTimeout(() => handler(new Error("WebSocket error")), 0);
          }
        }),
      };

      mockWss.handleUpgrade.mockImplementation(
        (req: any, socket: any, head: any, callback: any) => {
          callback(mockWebSocket);
        },
      );

      upgradeHandler(mockReq, mockSocket, mockHead);

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("WebSocket error for agent test-agent"),
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });
});

describe("startHonoServer", () => {
  let mockRegistry: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegistry = createMockRegistry();
  });

  it("should create and start HonoVoltServer", async () => {
    const result = await startHonoServer(mockRegistry, { port: 3456 });

    expect(result).toEqual(
      expect.objectContaining({
        port: 3456,
        app: expect.any(Object),
        server: expect.any(Object),
        ws: expect.any(Object),
      }),
    );
  });

  it("should pass options to HonoVoltServer", async () => {
    const options = {
      port: 4567,
      hostname: "localhost",
      customEndpoints: [{ path: "/test", method: "get" as const, handler: jest.fn() }],
    };

    const result = await startHonoServer(mockRegistry, options);

    // Verify the server was created and started
    expect(result).toEqual(
      expect.objectContaining({
        port: 4567,
        app: expect.any(Object),
        server: expect.any(Object),
        ws: expect.any(Object),
      }),
    );
  });
});
