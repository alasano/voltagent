import {
  generateTextRoute,
  generateObjectRoute,
  streamTextRoute,
  streamObjectRoute,
} from "./generation-routes";
import type { LocalAgentRegistry } from "@voltagent/core";
import type { RouteContext } from "../../types";
import { z } from "zod";

// Mock zod-from-json-schema
jest.mock("zod-from-json-schema", () => ({
  convertJsonSchemaToZod: jest.fn((schema) => z.object({})), // Return a simple zod schema
}));

// Local mock creation functions
function createMockAgent(overrides: any = {}): any {
  return {
    id: "test-agent-" + Math.random().toString(36).substr(2, 9),
    name: "Test Agent",
    instructions: "Test instructions",
    generateText: jest.fn().mockResolvedValue({
      text: "Generated text response",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    }),
    generateObject: jest.fn().mockResolvedValue({
      object: { result: "generated object" },
      usage: { promptTokens: 15, completionTokens: 25, totalTokens: 40 },
    }),
    streamText: jest.fn().mockResolvedValue(createMockTextStream()),
    streamObject: jest.fn().mockResolvedValue(createMockObjectStream()),
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

function createMockTextStream(): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue("chunk1");
      controller.enqueue("chunk2");
      controller.close();
    },
  });
}

function createMockObjectStream(): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ partial: "object" });
      controller.enqueue({ complete: "object" });
      controller.close();
    },
  });
}

describe("Generation Routes", () => {
  let mockRegistry: jest.Mocked<LocalAgentRegistry>;
  let mockAgent: any;
  let mockContext: RouteContext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegistry = createMockRegistry();
    mockAgent = createMockAgent();
    mockContext = createMockRouteContext();
  });

  describe("generateTextRoute", () => {
    it("should have correct route definition", () => {
      expect(generateTextRoute.method).toBe("post");
      expect(generateTextRoute.path).toBe("/agents/{id}/text");
      expect(generateTextRoute.openapi).toBeDefined();
      expect(generateTextRoute.openapi?.tags).toContain("Agent Generation");
      expect(generateTextRoute.openapi?.summary).toBe("Generate text");
    });

    it("should generate text successfully", async () => {
      mockAgent.generateText.mockResolvedValue({
        text: "Generated response",
        usage: { totalTokens: 100 },
      });
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: "Test prompt",
          options: { temperature: 0.7 },
        },
      });

      const response = await generateTextRoute.handler(params, context, mockRegistry);

      expect(mockRegistry.getAgent).toHaveBeenCalledWith("agent-1");
      expect(mockAgent.generateText).toHaveBeenCalledWith("Test prompt", { temperature: 0.7 });
      expect(response).toEqual({
        text: "Generated response",
        usage: { totalTokens: 100 },
      });
    });

    it("should handle string input", async () => {
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: "Simple string input",
        },
      });

      await generateTextRoute.handler(params, context, mockRegistry);

      expect(mockAgent.generateText).toHaveBeenCalledWith("Simple string input", {});
    });

    it("should handle message array input", async () => {
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: [
            { role: "user", content: "What is the weather?" },
            { role: "assistant", content: "The weather is sunny." },
          ],
        },
      });

      await generateTextRoute.handler(params, context, mockRegistry);

      expect(mockAgent.generateText).toHaveBeenCalledWith(
        [
          { role: "user", content: "What is the weather?" },
          { role: "assistant", content: "The weather is sunny." },
        ],
        {},
      );
    });

    it("should handle multimodal input", async () => {
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
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
          options: { maxTokens: 1000 },
        },
      });

      await generateTextRoute.handler(params, context, mockRegistry);

      expect(mockAgent.generateText).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.arrayContaining([
              { type: "text", text: "What's in this image?" },
              expect.objectContaining({ type: "image" }),
            ]),
          }),
        ]),
        { maxTokens: 1000 },
      );
    });

    it("should handle default options when not provided", async () => {
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: "Test without options",
        },
      });

      await generateTextRoute.handler(params, context, mockRegistry);

      expect(mockAgent.generateText).toHaveBeenCalledWith("Test without options", {});
    });

    it("should handle empty body", async () => {
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: undefined,
      });

      await generateTextRoute.handler(params, context, mockRegistry);

      expect(mockAgent.generateText).toHaveBeenCalledWith(undefined, {});
    });

    it("should throw error when agent not found", async () => {
      mockRegistry.getAgent.mockReturnValue(undefined);

      const params = { id: "nonexistent-agent" };
      const context = createMockRouteContext({
        body: { input: "test" },
      });

      await expect(generateTextRoute.handler(params, context, mockRegistry)).rejects.toThrow(
        "Agent not found",
      );

      expect(mockRegistry.getAgent).toHaveBeenCalledWith("nonexistent-agent");
    });

    it("should handle generation errors", async () => {
      mockAgent.generateText.mockRejectedValue(new Error("Generation failed"));
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: { input: "test" },
      });

      await expect(generateTextRoute.handler(params, context, mockRegistry)).rejects.toThrow(
        "Generation failed",
      );
    });

    it("should handle complex generation options", async () => {
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: "Complex request",
          options: {
            temperature: 0.8,
            maxTokens: 2000,
            topP: 0.9,
            frequencyPenalty: 0.1,
            presencePenalty: 0.2,
            seed: 42,
            stopSequences: ["STOP", "END"],
            extraOptions: { customParam: "value" },
          },
        },
      });

      await generateTextRoute.handler(params, context, mockRegistry);

      expect(mockAgent.generateText).toHaveBeenCalledWith("Complex request", {
        temperature: 0.8,
        maxTokens: 2000,
        topP: 0.9,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2,
        seed: 42,
        stopSequences: ["STOP", "END"],
        extraOptions: { customParam: "value" },
      });
    });
  });

  describe("generateObjectRoute", () => {
    it("should have correct route definition", () => {
      expect(generateObjectRoute.method).toBe("post");
      expect(generateObjectRoute.path).toBe("/agents/{id}/object");
      expect(generateObjectRoute.openapi).toBeDefined();
      expect(generateObjectRoute.openapi?.summary).toBe("Generate structured object");
    });

    it("should generate object successfully", async () => {
      mockAgent.generateObject.mockResolvedValue({
        object: { name: "John", age: 30 },
        usage: { totalTokens: 150 },
      });
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: "Extract user info: John, 30 years old",
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "number" },
            },
          },
          options: { temperature: 0.1 },
        },
      });

      const response = await generateObjectRoute.handler(params, context, mockRegistry);

      expect(mockRegistry.getAgent).toHaveBeenCalledWith("agent-1");
      expect(mockAgent.generateObject).toHaveBeenCalledWith(
        "Extract user info: John, 30 years old",
        expect.any(Object), // Zod schema after conversion
        { temperature: 0.1 },
      );
      expect(response).toEqual({
        object: { name: "John", age: 30 },
        usage: { totalTokens: 150 },
      });
    });

    it("should handle Zod schema directly", async () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: "Extract data",
          schema: zodSchema,
        },
      });

      await generateObjectRoute.handler(params, context, mockRegistry);

      expect(mockAgent.generateObject).toHaveBeenCalledWith("Extract data", zodSchema, {});
    });

    it("should convert JSON schema to Zod", async () => {
      const { convertJsonSchemaToZod } = require("zod-from-json-schema");
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const jsonSchema = {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          count: { type: "number" },
        },
        required: ["email"],
      };

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: "Extract email and count",
          schema: jsonSchema,
        },
      });

      await generateObjectRoute.handler(params, context, mockRegistry);

      expect(convertJsonSchemaToZod).toHaveBeenCalledWith(jsonSchema);
      expect(mockAgent.generateObject).toHaveBeenCalledWith(
        "Extract email and count",
        expect.any(Object),
        {},
      );
    });

    it("should handle message array input for object generation", async () => {
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: [
            { role: "user", content: "Extract data from this conversation" },
            { role: "assistant", content: "I'll help extract the data" },
            { role: "user", content: "Name: Alice, Age: 25, City: New York" },
          ],
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "number" },
              city: { type: "string" },
            },
          },
        },
      });

      await generateObjectRoute.handler(params, context, mockRegistry);

      expect(mockAgent.generateObject).toHaveBeenCalledWith(
        expect.arrayContaining([
          { role: "user", content: "Extract data from this conversation" },
          { role: "assistant", content: "I'll help extract the data" },
          { role: "user", content: "Name: Alice, Age: 25, City: New York" },
        ]),
        expect.any(Object),
        {},
      );
    });

    it("should throw error when agent not found", async () => {
      mockRegistry.getAgent.mockReturnValue(undefined);

      const params = { id: "nonexistent-agent" };
      const context = createMockRouteContext({
        body: {
          input: "test",
          schema: { type: "object" },
        },
      });

      await expect(generateObjectRoute.handler(params, context, mockRegistry)).rejects.toThrow(
        "Agent not found",
      );
    });

    it("should handle complex nested schemas", async () => {
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const complexSchema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "number" },
              addresses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    street: { type: "string" },
                    city: { type: "string" },
                    zipCode: { type: "string" },
                  },
                },
              },
            },
          },
          metadata: {
            type: "object",
            additionalProperties: true,
          },
        },
      };

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: "Extract complex user data",
          schema: complexSchema,
          options: { maxTokens: 3000 },
        },
      });

      await generateObjectRoute.handler(params, context, mockRegistry);

      expect(mockAgent.generateObject).toHaveBeenCalledWith(
        "Extract complex user data",
        expect.any(Object),
        { maxTokens: 3000 },
      );
    });
  });

  describe("streamTextRoute", () => {
    it("should have correct route definition", () => {
      expect(streamTextRoute.method).toBe("post");
      expect(streamTextRoute.path).toBe("/agents/{id}/stream");
      expect(streamTextRoute.openapi).toBeDefined();
      expect(streamTextRoute.openapi?.summary).toBe("Stream text generation");
      expect(streamTextRoute.openapi?.responses[200].content).toHaveProperty("text/event-stream");
    });

    it("should stream text successfully", async () => {
      const mockStream = createMockTextStream();
      mockAgent.streamText.mockResolvedValue(mockStream);
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: "Stream this text",
          options: { temperature: 0.8 },
        },
      });

      const response = await streamTextRoute.handler(params, context, mockRegistry);

      expect(mockRegistry.getAgent).toHaveBeenCalledWith("agent-1");
      expect(mockAgent.streamText).toHaveBeenCalledWith("Stream this text", { temperature: 0.8 });
      expect(response).toBe(mockStream);
    });

    it("should handle streaming with default options", async () => {
      const mockStream = createMockTextStream();
      mockAgent.streamText.mockResolvedValue(mockStream);
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: "Stream without options",
        },
      });

      await streamTextRoute.handler(params, context, mockRegistry);

      expect(mockAgent.streamText).toHaveBeenCalledWith("Stream without options", {});
    });

    it("should handle multimodal streaming input", async () => {
      const mockStream = createMockTextStream();
      mockAgent.streamText.mockResolvedValue(mockStream);
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: [
            {
              role: "user",
              content: [
                { type: "text", text: "Analyze and stream response about this file" },
                {
                  type: "file",
                  data: "base64filedata",
                  filename: "report.pdf",
                  mimeType: "application/pdf",
                },
              ],
            },
          ],
        },
      });

      await streamTextRoute.handler(params, context, mockRegistry);

      expect(mockAgent.streamText).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.arrayContaining([
              { type: "text", text: "Analyze and stream response about this file" },
              expect.objectContaining({ type: "file", filename: "report.pdf" }),
            ]),
          }),
        ]),
        {},
      );
    });

    it("should throw error when agent not found", async () => {
      mockRegistry.getAgent.mockReturnValue(undefined);

      const params = { id: "nonexistent-agent" };
      const context = createMockRouteContext({
        body: { input: "test" },
      });

      await expect(streamTextRoute.handler(params, context, mockRegistry)).rejects.toThrow(
        "Agent not found",
      );
    });

    it("should handle streaming errors", async () => {
      mockAgent.streamText.mockRejectedValue(new Error("Streaming failed"));
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: { input: "test stream" },
      });

      await expect(streamTextRoute.handler(params, context, mockRegistry)).rejects.toThrow(
        "Streaming failed",
      );
    });
  });

  describe("streamObjectRoute", () => {
    it("should have correct route definition", () => {
      expect(streamObjectRoute.method).toBe("post");
      expect(streamObjectRoute.path).toBe("/agents/{id}/stream-object");
      expect(streamObjectRoute.openapi).toBeDefined();
      expect(streamObjectRoute.openapi?.summary).toBe("Stream object generation");
      expect(streamObjectRoute.openapi?.responses[200].content).toHaveProperty("text/event-stream");
    });

    it("should stream object generation successfully", async () => {
      const mockStream = createMockObjectStream();
      mockAgent.streamObject.mockResolvedValue(mockStream);
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: "Stream object extraction",
          schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
          options: { temperature: 0.2 },
        },
      });

      const response = await streamObjectRoute.handler(params, context, mockRegistry);

      expect(mockRegistry.getAgent).toHaveBeenCalledWith("agent-1");
      expect(mockAgent.streamObject).toHaveBeenCalledWith(
        "Stream object extraction",
        expect.any(Object), // Converted Zod schema
        { temperature: 0.2 },
      );
      expect(response).toBe(mockStream);
    });

    it("should handle Zod schema for streaming", async () => {
      const zodSchema = z.object({
        results: z.array(z.string()),
        count: z.number(),
      });

      const mockStream = createMockObjectStream();
      mockAgent.streamObject.mockResolvedValue(mockStream);
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: "Stream with Zod schema",
          schema: zodSchema,
        },
      });

      await streamObjectRoute.handler(params, context, mockRegistry);

      expect(mockAgent.streamObject).toHaveBeenCalledWith("Stream with Zod schema", zodSchema, {});
    });

    it("should convert JSON schema for streaming", async () => {
      const { convertJsonSchemaToZod } = require("zod-from-json-schema");
      const mockStream = createMockObjectStream();
      mockAgent.streamObject.mockResolvedValue(mockStream);
      mockRegistry.getAgent.mockReturnValue(mockAgent);

      const jsonSchema = {
        type: "object",
        properties: {
          streamData: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                value: { type: "number" },
              },
            },
          },
        },
      };

      const params = { id: "agent-1" };
      const context = createMockRouteContext({
        body: {
          input: "Stream complex objects",
          schema: jsonSchema,
        },
      });

      await streamObjectRoute.handler(params, context, mockRegistry);

      expect(convertJsonSchemaToZod).toHaveBeenCalledWith(jsonSchema);
      expect(mockAgent.streamObject).toHaveBeenCalledWith(
        "Stream complex objects",
        expect.any(Object),
        {},
      );
    });

    it("should throw error when agent not found", async () => {
      mockRegistry.getAgent.mockReturnValue(undefined);

      const params = { id: "nonexistent-agent" };
      const context = createMockRouteContext({
        body: {
          input: "test",
          schema: { type: "object" },
        },
      });

      await expect(streamObjectRoute.handler(params, context, mockRegistry)).rejects.toThrow(
        "Agent not found",
      );
    });
  });

  describe("Route OpenAPI schemas", () => {
    it("should have proper request/response schemas for generateTextRoute", () => {
      const openapi = generateTextRoute.openapi;
      expect(openapi?.request?.params).toBeDefined();
      expect(openapi?.request?.body).toBeDefined();
      expect(openapi?.responses[200]).toBeDefined();
      expect(openapi?.responses[404]).toBeDefined();
      expect(openapi?.responses[500]).toBeDefined();
    });

    it("should have proper request/response schemas for generateObjectRoute", () => {
      const openapi = generateObjectRoute.openapi;
      expect(openapi?.request?.params).toBeDefined();
      expect(openapi?.request?.body).toBeDefined();
      expect(openapi?.responses[200]).toBeDefined();
      expect(openapi?.responses[404]).toBeDefined();
      expect(openapi?.responses[500]).toBeDefined();
    });

    it("should have streaming response schemas", () => {
      expect(streamTextRoute.openapi?.responses[200].content).toHaveProperty("text/event-stream");
      expect(streamObjectRoute.openapi?.responses[200].content).toHaveProperty("text/event-stream");
    });

    it("should have appropriate tags for all generation routes", () => {
      const routes = [generateTextRoute, generateObjectRoute, streamTextRoute, streamObjectRoute];

      routes.forEach((route) => {
        expect(route.openapi?.tags).toBeDefined();
        expect(route.openapi?.tags).toContain("Agent Generation");
      });
    });

    it("should have descriptive summaries and descriptions", () => {
      const routes = [
        { route: generateTextRoute, summary: "Generate text" },
        { route: generateObjectRoute, summary: "Generate structured object" },
        { route: streamTextRoute, summary: "Stream text generation" },
        { route: streamObjectRoute, summary: "Stream object generation" },
      ];

      routes.forEach(({ route, summary }) => {
        expect(route.openapi?.summary).toBe(summary);
        expect(route.openapi?.description).toBeDefined();
        expect(route.openapi?.description?.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complete generation workflow", async () => {
      const agent = createMockAgent({
        id: "workflow-agent",
        generateText: jest.fn().mockResolvedValue({
          text: "Generated text",
          usage: { totalTokens: 100 },
        }),
        generateObject: jest.fn().mockResolvedValue({
          object: { extracted: "data" },
          usage: { totalTokens: 150 },
        }),
        streamText: jest.fn().mockResolvedValue(createMockTextStream()),
        streamObject: jest.fn().mockResolvedValue(createMockObjectStream()),
      });

      mockRegistry.getAgent.mockReturnValue(agent);

      const params = { id: "workflow-agent" };

      // Test text generation
      const textContext = createMockRouteContext({
        body: { input: "Generate text", options: { temperature: 0.7 } },
      });
      const textResult = await generateTextRoute.handler(params, textContext, mockRegistry);
      expect(textResult.text).toBe("Generated text");

      // Test object generation
      const objectContext = createMockRouteContext({
        body: {
          input: "Extract data",
          schema: { type: "object", properties: { data: { type: "string" } } },
        },
      });
      const objectResult = await generateObjectRoute.handler(params, objectContext, mockRegistry);
      expect(objectResult.object.extracted).toBe("data");

      // Test streaming
      const streamContext = createMockRouteContext({
        body: { input: "Stream text" },
      });
      const streamResult = await streamTextRoute.handler(params, streamContext, mockRegistry);
      expect(streamResult).toBeInstanceOf(ReadableStream);

      // Verify all methods were called
      expect(agent.generateText).toHaveBeenCalled();
      expect(agent.generateObject).toHaveBeenCalled();
      expect(agent.streamText).toHaveBeenCalled();
    });

    it("should handle concurrent generation requests", async () => {
      const agent = createMockAgent();
      mockRegistry.getAgent.mockReturnValue(agent);

      const params = { id: "concurrent-agent" };

      // Simulate concurrent requests
      const promises = [
        generateTextRoute.handler(
          params,
          createMockRouteContext({ body: { input: "Text 1" } }),
          mockRegistry,
        ),
        generateTextRoute.handler(
          params,
          createMockRouteContext({ body: { input: "Text 2" } }),
          mockRegistry,
        ),
        generateObjectRoute.handler(
          params,
          createMockRouteContext({
            body: { input: "Object", schema: { type: "object" } },
          }),
          mockRegistry,
        ),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(agent.generateText).toHaveBeenCalledTimes(2);
      expect(agent.generateObject).toHaveBeenCalledTimes(1);
    });
  });
});
