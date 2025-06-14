import type { LocalAgentRegistry } from "@voltagent/core";
import type { RouteDefinition } from "../../types";
import {
  ParamsSchema,
  ErrorSchema,
  TextRequestSchema,
  TextResponseSchema,
  ObjectRequestSchema,
  ObjectResponseSchema,
} from "./types";
import { z } from "@hono/zod-openapi";
import { convertJsonSchemaToZod } from "zod-from-json-schema";

/**
 * POST /agents/:id/text - Generate text
 */
export const generateTextRoute: RouteDefinition = {
  method: "post",
  path: "/agents/{id}/text",
  openapi: {
    request: {
      params: ParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: TextRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Successfully generated text",
        content: {
          "application/json": {
            schema: TextResponseSchema,
          },
        },
      },
      404: {
        description: "Agent not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      500: {
        description: "Generation failed",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
    tags: ["Agent Generation"],
    summary: "Generate text",
    description: "Generate text response from an agent based on input",
  },
  handler: async (params, context, registry: LocalAgentRegistry) => {
    const agent = registry.getAgent(params.id);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const { input, options = {} } = context.body || {};
    const response = await agent.generateText(input, options);

    // TODO: Fix this once we can force a change to the response type
    const fixBadResponseTypeForBackwardsCompatibility = response as any;
    return { success: true, data: fixBadResponseTypeForBackwardsCompatibility };
  },
};

/**
 * POST /agents/:id/object - Generate object
 */
export const generateObjectRoute: RouteDefinition = {
  method: "post",
  path: "/agents/{id}/object",
  openapi: {
    request: {
      params: ParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: ObjectRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Successfully generated object",
        content: {
          "application/json": {
            schema: ObjectResponseSchema,
          },
        },
      },
      404: {
        description: "Agent not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      500: {
        description: "Generation failed",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
    tags: ["Agent Generation"],
    summary: "Generate structured object",
    description: "Generate a structured object from an agent based on input and schema",
  },
  handler: async (params, context, registry: LocalAgentRegistry) => {
    const agent = registry.getAgent(params.id);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const { input, schema, options = {} } = context.body || {};

    // Convert JSON schema to Zod if needed
    let zodSchema = schema;
    if (typeof schema === "object" && schema.type) {
      zodSchema = convertJsonSchemaToZod(schema);
    }

    const response = await agent.generateObject(input, zodSchema, options);

    // TODO: Fix this once we can force a change to the response type
    const fixBadResponseTypeForBackwardsCompatibility = response as any;
    return {
      success: true,
      data: fixBadResponseTypeForBackwardsCompatibility,
    };
  },
};

/**
 * Stream response event schema for SSE
 */
const StreamEventSchema = z.object({
  text: z.string().optional(),
  object: z.any().optional(),
  timestamp: z.string(),
  type: z.enum([
    "text",
    "object",
    "completion",
    "error",
    "reasoning",
    "source",
    "tool-call",
    "tool-result",
    "finish",
  ]),
  done: z.boolean().optional(),
  error: z.string().optional(),
  reasoning: z.string().optional(),
  source: z.string().optional(),
  toolCall: z
    .object({
      toolCallId: z.string(),
      toolName: z.string(),
      args: z.any(),
    })
    .optional(),
  toolResult: z
    .object({
      toolCallId: z.string(),
      toolName: z.string(),
      result: z.any(),
    })
    .optional(),
  finishReason: z.string().optional(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
  code: z.string().optional(),
});

/**
 * POST /agents/:id/stream - Stream text generation
 */
export const streamTextRoute: RouteDefinition = {
  method: "post",
  path: "/agents/{id}/stream",
  openapi: {
    request: {
      params: ParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: TextRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Server-sent event stream",
        content: {
          "text/event-stream": {
            schema: StreamEventSchema,
          },
        },
      },
      404: {
        description: "Agent not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
    tags: ["Agent Generation"],
    summary: "Stream text generation",
    description: "Stream text generation from an agent using Server-Sent Events",
  },
  handler: async (params, context, registry: LocalAgentRegistry) => {
    const agent = registry.getAgent(params.id);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const { input, options = {} } = context.body || {};

    // Pass the streamEventForwarder from context if available
    const streamOptions = {
      ...options,
      ...(context.streamEventForwarder && { streamEventForwarder: context.streamEventForwarder }),
    };

    return await agent.streamText(input, streamOptions);
  },
};

/**
 * POST /agents/:id/stream-object - Stream object generation
 */
export const streamObjectRoute: RouteDefinition = {
  method: "post",
  path: "/agents/{id}/stream-object",
  openapi: {
    request: {
      params: ParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: ObjectRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Server-sent event stream for object generation",
        content: {
          "text/event-stream": {
            schema: StreamEventSchema,
          },
        },
      },
      404: {
        description: "Agent not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
    tags: ["Agent Generation"],
    summary: "Stream object generation",
    description: "Stream structured object generation from an agent using Server-Sent Events",
  },
  handler: async (params, context, registry: LocalAgentRegistry) => {
    const agent = registry.getAgent(params.id);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const { input, schema, options = {} } = context.body || {};

    // Convert JSON schema to Zod if needed
    let zodSchema = schema;
    if (typeof schema === "object" && schema.type) {
      zodSchema = convertJsonSchemaToZod(schema);
    }

    return await agent.streamObject(input, zodSchema, options);
  },
};
