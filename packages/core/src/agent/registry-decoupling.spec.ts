import { Agent } from "./index";
import { LocalAgentRegistry } from "../registry";

// Mock devLogger to avoid console spam
jest.mock("../utils/internal/dev-logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// The singleton AgentRegistry is gone, so we no longer need to mock it.
// Tests will be adapted to check the new behavior.

describe("Agent Registry Decoupling", () => {
  const mockProvider = {
    llm: {
      generateText: jest.fn(),
      streamText: jest.fn(),
      generateObject: jest.fn(),
      streamObject: jest.fn(),
      toMessage: jest.fn(),
      getModelIdentifier: jest.fn().mockReturnValue("mock-model"),
    },
  };

  describe("Agent with LocalAgentRegistry", () => {
    let registry: LocalAgentRegistry;
    let agent: Agent<typeof mockProvider>;

    beforeEach(() => {
      jest.clearAllMocks();
      registry = new LocalAgentRegistry();

      agent = new Agent({
        name: "Test Agent",
        instructions: "Test instructions",
        model: "mock-model",
        registry,
        ...mockProvider,
      });
    });

    it("should store the provided LocalAgentRegistry", () => {
      expect(agent.getRegistry()).toBe(registry);
    });

    it("should not have a global exporter by default when a registry is provided", () => {
      // Since LocalAgentRegistry doesn't have a global exporter, this should be false.
      expect(agent.isTelemetryConfigured()).toBe(false);
    });

    it("should work with sub-agents using LocalAgentRegistry", () => {
      const subAgent = new Agent({
        name: "Sub Agent",
        instructions: "Sub agent instructions",
        model: "mock-model",
        registry,
        ...mockProvider,
      });

      const registerSpy = jest.spyOn(registry, "registerSubAgent");

      // Manually add the sub-agent to test registry usage
      (agent as any).subAgentManager.addSubAgent(subAgent);

      expect(registerSpy).toHaveBeenCalledWith(agent.id, subAgent.id);
    });
  });

  describe("Agent without LocalAgentRegistry (Legacy Mode)", () => {
    let agent: Agent<typeof mockProvider>;

    beforeEach(() => {
      jest.clearAllMocks();

      agent = new Agent({
        name: "Legacy Agent",
        instructions: "Legacy instructions",
        model: "mock-model",
        // No registry provided - should use singleton
        ...mockProvider,
      });
    });

    it("should create an internal LocalAgentRegistry if none is provided", () => {
      expect(agent.getRegistry()).toBeInstanceOf(LocalAgentRegistry);
    });

    it("should use its internal registry for sub-agent management", () => {
      const subAgent = new Agent({
        name: "Legacy Sub Agent",
        instructions: "Legacy sub instructions",
        model: "mock-model",
        ...mockProvider,
      });

      const registry = agent.getRegistry();
      const registerSpy = jest.spyOn(registry!, "registerSubAgent");

      (agent as any).subAgentManager.addSubAgent(subAgent);

      expect(registerSpy).toHaveBeenCalledWith(agent.id, subAgent.id);
    });
  });

  describe("Agent Registry Independence", () => {
    it("should create agents independently without automatic registration", () => {
      const registry = new LocalAgentRegistry();

      const agent1 = new Agent({
        name: "Independent Agent 1",
        instructions: "Instructions 1",
        model: "mock-model",
        registry,
        ...mockProvider,
      });

      const agent2 = new Agent({
        name: "Independent Agent 2",
        instructions: "Instructions 2",
        model: "mock-model",
        registry,
        ...mockProvider,
      });

      // Agents should not be automatically registered
      expect(registry.getAgentCount()).toBe(0);
      expect(registry.getAgent(agent1.id)).toBeUndefined();
      expect(registry.getAgent(agent2.id)).toBeUndefined();

      // Manual registration should work
      registry.registerAgent(agent1);
      registry.registerAgent(agent2);

      expect(registry.getAgentCount()).toBe(2);
      expect(registry.getAgent(agent1.id)).toBe(agent1);
      expect(registry.getAgent(agent2.id)).toBe(agent2);
    });

    it("should allow agents to be created without any registry", () => {
      const standaloneAgent = new Agent({
        name: "Standalone Agent",
        instructions: "Standalone instructions",
        model: "mock-model",
        // No registry provided at all
        ...mockProvider,
      });

      // In the new model, it will always have an internal registry.
      expect(standaloneAgent.getRegistry()).toBeInstanceOf(LocalAgentRegistry);
      expect(standaloneAgent.id).toBeTruthy();
      expect(standaloneAgent.name).toBe("Standalone Agent");
    });

    it("should handle telemetry correctly with LocalAgentRegistry", () => {
      const registry = new LocalAgentRegistry();

      const agentWithRegistry = new Agent({
        name: "Agent with Registry",
        instructions: "Test instructions",
        model: "mock-model",
        registry,
        ...mockProvider,
      });

      // LocalAgentRegistry doesn't provide global exporter, so telemetry should not be configured by default
      expect(agentWithRegistry.isTelemetryConfigured()).toBe(false);
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain backward compatibility with existing Agent usage", () => {
      const legacyAgent = new Agent({
        name: "Legacy Compatible Agent",
        instructions: "Legacy instructions",
        model: "mock-model",
        ...mockProvider,
      });

      // Should work exactly like before
      expect(legacyAgent.name).toBe("Legacy Compatible Agent");
      // In the new model, it will always have an internal registry.
      expect(legacyAgent.getRegistry()).toBeInstanceOf(LocalAgentRegistry);
      expect(typeof legacyAgent.generateText).toBe("function");
    });
  });
});
