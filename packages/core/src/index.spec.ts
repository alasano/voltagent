import { VoltAgent } from "./index";
import { LocalAgentRegistry } from "./registry";

// Mock devLogger to avoid console spam in tests
jest.mock("./utils/internal/dev-logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the dynamic import for server module
const mockStartLegacyHonoServer = jest.fn().mockResolvedValue(undefined);

// Mock the dynamic import() call
(global as any).import = jest.fn().mockImplementation((moduleName: string) => {
  if (moduleName === "@voltagent/server") {
    return Promise.resolve({
      _startLegacyHonoServer: mockStartLegacyHonoServer,
    });
  }
  // For other modules, just throw MODULE_NOT_FOUND to simulate missing optional dependencies
  return Promise.reject({ code: "MODULE_NOT_FOUND" });
});

// Mock checkForUpdates
jest.mock("./utils/update", () => ({
  checkForUpdates: jest.fn().mockResolvedValue({
    hasUpdates: false,
    message: "All packages are up to date",
  }),
}));

describe("VoltAgent serverMode functionality", () => {
  let mockAgent: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a minimal mock agent
    mockAgent = {
      id: "test-agent",
      name: "Test Agent",
      getSubAgents: () => [],
    };
  });

  describe("constructor serverMode options", () => {
    it("should default to 'auto' serverMode when not specified", () => {
      const voltAgent = new VoltAgent({
        agents: { testAgent: mockAgent },
        autoStart: false, // Prevent server startup in tests
      });

      expect(voltAgent.getServerMode()).toBe("auto");
      expect(voltAgent.isLegacyMode()).toBe(true);
    });

    it("should respect explicit serverMode: 'disabled'", () => {
      const voltAgent = new VoltAgent({
        agents: { testAgent: mockAgent },
        serverMode: "disabled",
      });

      expect(voltAgent.getServerMode()).toBe("disabled");
      expect(voltAgent.isLegacyMode()).toBe(false);
    });

    it("should respect explicit serverMode: 'manual'", () => {
      const voltAgent = new VoltAgent({
        agents: { testAgent: mockAgent },
        serverMode: "manual",
      });

      expect(voltAgent.getServerMode()).toBe("manual");
      expect(voltAgent.isLegacyMode()).toBe(false);
    });

    it("should use LocalAgentRegistry when provided", () => {
      const registry = new LocalAgentRegistry();
      const voltAgent = new VoltAgent({
        agents: { testAgent: mockAgent },
        registry,
        serverMode: "disabled",
      });

      expect(voltAgent.getRegistry()).toBe(registry);
      expect(voltAgent.isLegacyMode()).toBe(false);
    });

    it("should register agents in provided LocalAgentRegistry", () => {
      const registry = new LocalAgentRegistry();
      const registerSpy = jest.spyOn(registry, "registerAgent");

      new VoltAgent({
        agents: { testAgent: mockAgent },
        registry,
        serverMode: "disabled",
      });

      expect(registerSpy).toHaveBeenCalledWith(mockAgent);
    });
  });

  describe("registry access methods", () => {
    it("should provide access to registry instance", () => {
      const registry = new LocalAgentRegistry();
      const voltAgent = new VoltAgent({
        agents: { testAgent: mockAgent },
        registry,
        serverMode: "disabled",
      });

      expect(voltAgent.getRegistry()).toBe(registry);
    });

    it("should maintain backward compatibility for agent access", () => {
      const voltAgent = new VoltAgent({
        agents: { testAgent: mockAgent },
        serverMode: "disabled",
      });

      expect(voltAgent.getAgentCount()).toBe(1);
      expect(voltAgent.getAgent("test-agent")).toBe(mockAgent);
      expect(voltAgent.getAgents()).toContain(mockAgent);
    });
  });

  describe("deprecation warnings", () => {
    it("should show deprecation warning for default autoStart behavior", () => {
      const devLogger = require("./utils/internal/dev-logger").default;

      new VoltAgent({
        agents: { testAgent: mockAgent },
        // Don't set autoStart: false to test the default behavior
        checkDependencies: false, // Prevent dependency checks in tests
      });

      expect(devLogger.warn).toHaveBeenCalledWith(expect.stringContaining("DEPRECATION"));
    });

    it("should not show deprecation warning when serverMode is explicit", () => {
      const devLogger = require("./utils/internal/dev-logger").default;

      new VoltAgent({
        agents: { testAgent: mockAgent },
        serverMode: "auto",
        checkDependencies: false,
        autoStart: false,
      });

      expect(devLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe("server startup behavior", () => {
    it("should not start server when serverMode is 'disabled'", async () => {
      new VoltAgent({
        agents: { testAgent: mockAgent },
        serverMode: "disabled",
      });

      // Allow time for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockStartLegacyHonoServer).not.toHaveBeenCalled();
    });
  });

  describe("telemetry handling", () => {
    it("should handle telemetry with LocalAgentRegistry gracefully", () => {
      const registry = new LocalAgentRegistry();

      expect(() => {
        new VoltAgent({
          agents: { testAgent: mockAgent },
          registry,
          serverMode: "disabled",
          telemetryExporter: {
            export: jest.fn(),
            shutdown: jest.fn(),
          } as any,
        });
      }).not.toThrow();
    });
  });
});
