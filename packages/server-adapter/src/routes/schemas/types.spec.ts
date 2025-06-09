import { z } from "@hono/zod-openapi";
import {
  ParamsSchema,
  ErrorSchema,
  SubAgentResponseSchema,
  AgentResponseSchema,
  GenerateOptionsSchema,
  TextRequestSchema,
  TextResponseSchema,
  ObjectRequestSchema,
  ObjectResponseSchema,
  HistoryEntrySchema,
  UpdateResponseSchema,
  UpdateActionResponseSchema,
  CountResponseSchema,
  HistoryResponseSchema,
} from "./types";

describe("Route Schema Types", () => {
  describe("ParamsSchema", () => {
    it("should validate valid agent ID parameter", () => {
      const validParams = { id: "my-agent-123" };

      const result = ParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("my-agent-123");
      }
    });

    it("should reject invalid parameter types", () => {
      const invalidParams = { id: 123 }; // Number instead of string

      const result = ParamsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it("should reject missing id parameter", () => {
      const missingParams = {};

      const result = ParamsSchema.safeParse(missingParams);
      expect(result.success).toBe(false);
    });

    it("should validate various agent ID formats", () => {
      const validIds = [
        "simple-agent",
        "agent_with_underscores",
        "agent-with-dashes",
        "agent123",
        "Agent.With.Dots",
        "uuid-like-string-12345",
      ];

      validIds.forEach((id) => {
        const result = ParamsSchema.safeParse({ id });
        expect(result.success).toBe(true);
      });
    });
  });

  describe("ErrorSchema", () => {
    it("should validate error response", () => {
      const validError = {
        success: false,
        error: "Something went wrong",
      };

      const result = ErrorSchema.safeParse(validError);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(false);
        expect(result.data.error).toBe("Something went wrong");
      }
    });

    it("should reject error response with success=true", () => {
      const invalidError = {
        success: true, // Should be false
        error: "Something went wrong",
      };

      const result = ErrorSchema.safeParse(invalidError);
      expect(result.success).toBe(false);
    });

    it("should reject error response without error message", () => {
      const invalidError = {
        success: false,
      };

      const result = ErrorSchema.safeParse(invalidError);
      expect(result.success).toBe(false);
    });

    it("should handle various error message types", () => {
      const errorMessages = [
        "Simple error message",
        "Error with special characters: !@#$%^&*()",
        "Multi-line\nerror\nmessage",
        "Error with numbers 12345",
        "",
      ];

      errorMessages.forEach((error) => {
        const result = ErrorSchema.safeParse({ success: false, error });
        expect(result.success).toBe(true);
      });
    });
  });

  describe("SubAgentResponseSchema", () => {
    it("should validate complete sub-agent response", () => {
      const validSubAgent = {
        id: "sub-agent-1",
        name: "Sub Agent",
        description: "A test sub-agent",
        status: "idle",
        model: "gpt-4",
        tools: [
          {
            name: "test-tool",
            description: "A test tool",
            parameters: { type: "object" },
          },
        ],
        memory: { context: "test context" },
      };

      const result = SubAgentResponseSchema.safeParse(validSubAgent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("sub-agent-1");
        expect(result.data.tools).toHaveLength(1);
      }
    });

    it("should validate minimal sub-agent response", () => {
      const minimalSubAgent = {
        id: "sub-agent-minimal",
        name: "Minimal Sub Agent",
        description: "Minimal description",
        status: "working",
        model: "claude-3",
      };

      const result = SubAgentResponseSchema.safeParse(minimalSubAgent);
      expect(result.success).toBe(true);
    });

    it("should allow passthrough properties", () => {
      const subAgentWithExtra = {
        id: "sub-agent-extra",
        name: "Sub Agent",
        description: "Description",
        status: "idle",
        model: "gpt-4",
        customProperty: "custom value",
        extraData: { nested: "data" },
      };

      const result = SubAgentResponseSchema.safeParse(subAgentWithExtra);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).customProperty).toBe("custom value");
        expect((result.data as any).extraData.nested).toBe("data");
      }
    });

    it("should handle different status values", () => {
      const statuses = ["idle", "working", "error", "completed", "paused"];

      statuses.forEach((status) => {
        const subAgent = {
          id: "test-agent",
          name: "Test Agent",
          description: "Test",
          status,
          model: "test-model",
        };

        const result = SubAgentResponseSchema.safeParse(subAgent);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("AgentResponseSchema", () => {
    it("should validate complete agent response", () => {
      const validAgent = {
        id: "agent-1",
        name: "Test Agent",
        description: "A test agent",
        status: "idle",
        model: "gpt-4",
        tools: [
          {
            name: "calculator",
            description: "Math calculator",
            parameters: { type: "object", properties: {} },
          },
        ],
        subAgents: [
          {
            id: "sub-1",
            name: "Sub Agent",
            description: "Sub description",
            status: "idle",
            model: "gpt-3.5",
          },
        ],
        memory: { conversationHistory: [] },
        isTelemetryEnabled: true,
      };

      const result = AgentResponseSchema.safeParse(validAgent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("agent-1");
        expect(result.data.tools).toHaveLength(1);
        expect(result.data.subAgents).toHaveLength(1);
        expect(result.data.isTelemetryEnabled).toBe(true);
      }
    });

    it("should validate agent without sub-agents", () => {
      const agentWithoutSubs = {
        id: "simple-agent",
        name: "Simple Agent",
        description: "No sub-agents",
        status: "working",
        model: "claude-3",
        tools: [],
        isTelemetryEnabled: false,
      };

      const result = AgentResponseSchema.safeParse(agentWithoutSubs);
      expect(result.success).toBe(true);
    });

    it("should require all mandatory fields", () => {
      const incompleteAgent = {
        id: "incomplete",
        name: "Incomplete Agent",
        // Missing required fields
      };

      const result = AgentResponseSchema.safeParse(incompleteAgent);
      expect(result.success).toBe(false);
    });

    it("should validate telemetry enabled/disabled states", () => {
      const agentTelemetryEnabled = {
        id: "agent-telemetry",
        name: "Agent",
        description: "Test",
        status: "idle",
        model: "gpt-4",
        tools: [],
        isTelemetryEnabled: true,
      };

      const agentTelemetryDisabled = {
        ...agentTelemetryEnabled,
        isTelemetryEnabled: false,
      };

      expect(AgentResponseSchema.safeParse(agentTelemetryEnabled).success).toBe(true);
      expect(AgentResponseSchema.safeParse(agentTelemetryDisabled).success).toBe(true);
    });
  });

  describe("GenerateOptionsSchema", () => {
    it("should validate complete generation options", () => {
      const validOptions = {
        userId: "user-123",
        conversationId: "conv-456",
        contextLimit: 20,
        temperature: 0.8,
        maxTokens: 2000,
        topP: 0.9,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2,
        seed: 42,
        stopSequences: ["STOP", "END"],
        extraOptions: { customParam: "value" },
      };

      const result = GenerateOptionsSchema.safeParse(validOptions);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.temperature).toBe(0.8);
        expect(result.data.maxTokens).toBe(2000);
        expect(result.data.stopSequences).toEqual(["STOP", "END"]);
      }
    });

    it("should apply default values", () => {
      const minimalOptions = {};

      const result = GenerateOptionsSchema.safeParse(minimalOptions);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contextLimit).toBe(10);
        expect(result.data.temperature).toBe(0.7);
        expect(result.data.maxTokens).toBe(4000);
        expect(result.data.topP).toBe(1.0);
        expect(result.data.frequencyPenalty).toBe(0.0);
        expect(result.data.presencePenalty).toBe(0.0);
      }
    });

    it("should validate temperature range", () => {
      const validTemperatures = [0, 0.5, 1.0];
      const invalidTemperatures = [-0.1, 1.1, 2.0];

      validTemperatures.forEach((temperature) => {
        const result = GenerateOptionsSchema.safeParse({ temperature });
        expect(result.success).toBe(true);
      });

      invalidTemperatures.forEach((temperature) => {
        const result = GenerateOptionsSchema.safeParse({ temperature });
        expect(result.success).toBe(false);
      });
    });

    it("should validate penalty ranges", () => {
      const validPenalties = [0, 1.0, 2.0];
      const invalidPenalties = [-0.1, 2.1, 3.0];

      validPenalties.forEach((penalty) => {
        const optionsFreq = { frequencyPenalty: penalty };
        const optionsPres = { presencePenalty: penalty };

        expect(GenerateOptionsSchema.safeParse(optionsFreq).success).toBe(true);
        expect(GenerateOptionsSchema.safeParse(optionsPres).success).toBe(true);
      });

      invalidPenalties.forEach((penalty) => {
        const optionsFreq = { frequencyPenalty: penalty };
        const optionsPres = { presencePenalty: penalty };

        expect(GenerateOptionsSchema.safeParse(optionsFreq).success).toBe(false);
        expect(GenerateOptionsSchema.safeParse(optionsPres).success).toBe(false);
      });
    });

    it("should validate positive integers for maxTokens and contextLimit", () => {
      const validIntegers = [1, 100, 4000];
      const invalidIntegers = [0, -1, 1.5, "100"];

      validIntegers.forEach((value) => {
        const optionsTokens = { maxTokens: value };
        const optionsContext = { contextLimit: value };

        expect(GenerateOptionsSchema.safeParse(optionsTokens).success).toBe(true);
        expect(GenerateOptionsSchema.safeParse(optionsContext).success).toBe(true);
      });

      invalidIntegers.forEach((value) => {
        const optionsTokens = { maxTokens: value };
        const optionsContext = { contextLimit: value };

        expect(GenerateOptionsSchema.safeParse(optionsTokens).success).toBe(false);
        expect(GenerateOptionsSchema.safeParse(optionsContext).success).toBe(false);
      });
    });
  });

  describe("TextRequestSchema", () => {
    it("should validate text string input", () => {
      const validRequest = {
        input: "Tell me a joke!",
        options: {
          temperature: 0.8,
          maxTokens: 100,
        },
      };

      const result = TextRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.input).toBe("Tell me a joke!");
        expect(result.data.options?.temperature).toBe(0.8);
      }
    });

    it("should validate message array input", () => {
      const validRequest = {
        input: [
          { role: "user", content: "What is the weather?" },
          { role: "assistant", content: "The weather is sunny." },
          { role: "user", content: [{ type: "text", text: "Thanks!" }] },
        ],
      };

      const result = TextRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data.input)).toBe(true);
        expect((result.data.input as any[]).length).toBe(3);
      }
    });

    it("should validate multimodal content", () => {
      const multimodalRequest = {
        input: [
          {
            role: "user",
            content: [
              { type: "text", text: "What's in this image?" },
              {
                type: "image",
                image:
                  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
                mimeType: "image/png",
              },
            ],
          },
        ],
      };

      const result = TextRequestSchema.safeParse(multimodalRequest);
      expect(result.success).toBe(true);
    });

    it("should validate file content", () => {
      const fileRequest = {
        input: [
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this document" },
              {
                type: "file",
                data: "base64encodedfiledata",
                filename: "document.pdf",
                mimeType: "application/pdf",
                size: 1024,
              },
            ],
          },
        ],
      };

      const result = TextRequestSchema.safeParse(fileRequest);
      expect(result.success).toBe(true);
    });

    it("should require input field", () => {
      const invalidRequest = {
        options: { temperature: 0.5 },
      };

      const result = TextRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe("TextResponseSchema", () => {
    it("should validate complete text response", () => {
      const validResponse = {
        success: true,
        data: {
          provider: { name: "openai", model: "gpt-4" },
          text: "Here's a funny joke for you!",
          usage: {
            promptTokens: 10,
            completionTokens: 15,
            totalTokens: 25,
          },
          toolCalls: [],
          toolResults: [],
          finishReason: "stop",
        },
      };

      const result = TextResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.data.text).toBe("Here's a funny joke for you!");
        expect(result.data.data.usage?.totalTokens).toBe(25);
      }
    });

    it("should validate minimal text response", () => {
      const minimalResponse = {
        success: true,
        data: {
          provider: {},
          text: "Simple response",
        },
      };

      const result = TextResponseSchema.safeParse(minimalResponse);
      expect(result.success).toBe(true);
    });

    it("should reject response with success=false", () => {
      const invalidResponse = {
        success: false, // Should be true
        data: {
          provider: {},
          text: "Response text",
        },
      };

      const result = TextResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe("ObjectRequestSchema", () => {
    it("should validate object generation request", () => {
      const validRequest = {
        input: "Extract user info: John Doe, 30 years old, john@example.com",
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" },
            email: { type: "string", format: "email" },
          },
          required: ["name", "age", "email"],
        },
        options: {
          temperature: 0.1,
          maxTokens: 200,
        },
      };

      const result = ObjectRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.input).toBe("string");
        expect(result.data.schema.type).toBe("object");
      }
    });

    it("should validate object request with message array", () => {
      const requestWithMessages = {
        input: [
          { role: "user", content: "Extract the data from this text" },
          { role: "assistant", content: "I'll help you extract the data." },
          { role: "user", content: "Name: Alice, Age: 25" },
        ],
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" },
          },
        },
      };

      const result = ObjectRequestSchema.safeParse(requestWithMessages);
      expect(result.success).toBe(true);
    });

    it("should require schema field", () => {
      const invalidRequest = {
        input: "Extract data",
        // Missing schema
      };

      const result = ObjectRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.includes("schema"))).toBe(true);
      }
    });
  });

  describe("ObjectResponseSchema", () => {
    it("should validate object generation response", () => {
      const validResponse = {
        success: true,
        data: {
          provider: { name: "anthropic", model: "claude-3" },
          object: {
            name: "John Doe",
            age: 30,
            email: "john@example.com",
          },
          usage: {
            promptTokens: 50,
            completionTokens: 25,
            totalTokens: 75,
          },
          finishReason: "stop",
        },
      };

      const result = ObjectResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.data.object.name).toBe("John Doe");
        expect(result.data.data.usage?.totalTokens).toBe(75);
      }
    });

    it("should validate minimal object response", () => {
      const minimalResponse = {
        success: true,
        data: {
          provider: {},
          object: { result: "extracted data" },
        },
      };

      const result = ObjectResponseSchema.safeParse(minimalResponse);
      expect(result.success).toBe(true);
    });
  });

  describe("HistoryEntrySchema", () => {
    it("should validate complete history entry", () => {
      const validEntry = {
        id: "entry-123",
        timestamp: "2024-01-01T12:00:00Z",
        type: "text",
        input: "User question",
        output: "Agent response",
        metadata: {
          userId: "user-123",
          sessionId: "session-456",
        },
      };

      const result = HistoryEntrySchema.safeParse(validEntry);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("entry-123");
        expect(result.data.type).toBe("text");
        expect(result.data.metadata?.userId).toBe("user-123");
      }
    });

    it("should validate different entry types", () => {
      const types = ["text", "object", "stream", "stream-object"];

      types.forEach((type) => {
        const entry = {
          id: `entry-${type}`,
          timestamp: "2024-01-01T12:00:00Z",
          type,
          input: "input",
          output: "output",
        };

        const result = HistoryEntrySchema.safeParse(entry);
        expect(result.success).toBe(true);
      });
    });

    it("should make metadata optional", () => {
      const entryWithoutMetadata = {
        id: "entry-no-meta",
        timestamp: "2024-01-01T12:00:00Z",
        type: "text",
        input: "input",
        output: "output",
      };

      const result = HistoryEntrySchema.safeParse(entryWithoutMetadata);
      expect(result.success).toBe(true);
    });
  });

  describe("UpdateResponseSchema", () => {
    it("should validate update check response", () => {
      const validResponse = {
        success: true,
        data: {
          hasUpdates: true,
          updates: [
            {
              packageName: "@voltagent/core",
              currentVersion: "1.0.0",
              latestVersion: "1.1.0",
              updateType: "minor",
            },
          ],
          count: 1,
        },
      };

      const result = UpdateResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.hasUpdates).toBe(true);
        expect(result.data.data.count).toBe(1);
        expect(result.data.data.updates[0].updateType).toBe("minor");
      }
    });

    it("should validate response with no updates", () => {
      const noUpdatesResponse = {
        success: true,
        data: {
          hasUpdates: false,
          updates: [],
          count: 0,
        },
      };

      const result = UpdateResponseSchema.safeParse(noUpdatesResponse);
      expect(result.success).toBe(true);
    });

    it("should validate different update types", () => {
      const updateTypes = ["major", "minor", "patch"];

      updateTypes.forEach((updateType) => {
        const response = {
          success: true,
          data: {
            hasUpdates: true,
            updates: [
              {
                packageName: "test-package",
                currentVersion: "1.0.0",
                latestVersion: "2.0.0",
                updateType,
              },
            ],
            count: 1,
          },
        };

        const result = UpdateResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("UpdateActionResponseSchema", () => {
    it("should validate update action response", () => {
      const validResponse = {
        success: true,
        data: {
          message: "Updates completed successfully",
          updatedPackages: ["@voltagent/core", "@voltagent/server"],
          updatedAt: "2024-01-01T12:00:00Z",
        },
      };

      const result = UpdateActionResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.message).toBe("Updates completed successfully");
        expect(result.data.data.updatedPackages).toHaveLength(2);
      }
    });

    it("should validate single package update", () => {
      const singleUpdateResponse = {
        success: true,
        data: {
          message: "Package updated",
          packageName: "@voltagent/core",
          updatedAt: "2024-01-01T12:00:00Z",
        },
      };

      const result = UpdateActionResponseSchema.safeParse(singleUpdateResponse);
      expect(result.success).toBe(true);
    });
  });

  describe("CountResponseSchema", () => {
    it("should validate count response", () => {
      const validResponse = {
        success: true,
        data: {
          count: 5,
        },
      };

      const result = CountResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.count).toBe(5);
      }
    });

    it("should validate zero count", () => {
      const zeroCountResponse = {
        success: true,
        data: {
          count: 0,
        },
      };

      const result = CountResponseSchema.safeParse(zeroCountResponse);
      expect(result.success).toBe(true);
    });

    it("should allow negative count (no validation constraint)", () => {
      const negativeCountResponse = {
        success: true,
        data: {
          count: -1,
        },
      };

      const result = CountResponseSchema.safeParse(negativeCountResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.count).toBe(-1);
      }
    });
  });

  describe("HistoryResponseSchema", () => {
    it("should validate history response with entries", () => {
      const validResponse = {
        success: true,
        data: [
          {
            id: "entry-1",
            timestamp: "2024-01-01T12:00:00Z",
            type: "text",
            input: "First question",
            output: "First response",
          },
          {
            id: "entry-2",
            timestamp: "2024-01-01T12:01:00Z",
            type: "object",
            input: "Second question",
            output: { result: "structured data" },
          },
        ],
      };

      const result = HistoryResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toHaveLength(2);
        expect(result.data.data[0].type).toBe("text");
        expect(result.data.data[1].type).toBe("object");
      }
    });

    it("should validate empty history response", () => {
      const emptyResponse = {
        success: true,
        data: [],
      };

      const result = HistoryResponseSchema.safeParse(emptyResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toHaveLength(0);
      }
    });
  });
});
