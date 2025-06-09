import { z } from "@hono/zod-openapi";

// Common Parameter Schema
export const ParamsSchema = z.object({
  id: z.string().openapi({
    param: { name: "id", in: "path" },
    description: "The ID of the agent",
    example: "my-agent-123",
  }),
});

// Common Error Response Schema
export const ErrorSchema = z.object({
  success: z.literal(false),
  error: z.string().openapi({ description: "Error message" }),
});

// SubAgent Response Schema
export const SubAgentResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    status: z.string().openapi({ description: "Current status of the sub-agent" }),
    model: z.string(),
    tools: z.array(z.any()).optional(),
    memory: z.any().optional(),
  })
  .passthrough();

// Agent Response Schema
export const AgentResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    status: z.string().openapi({ description: "Current status of the agent" }),
    model: z.string(),
    tools: z.array(z.any()),
    subAgents: z
      .array(SubAgentResponseSchema)
      .optional()
      .openapi({ description: "List of sub-agents" }),
    memory: z.any().optional(),
    isTelemetryEnabled: z
      .boolean()
      .openapi({ description: "Indicates if telemetry is configured for the agent" }),
  })
  .passthrough();

// Schema for common generation options
export const GenerateOptionsSchema = z
  .object({
    userId: z.string().optional().openapi({ description: "Optional user ID for context tracking" }),
    conversationId: z.string().optional().openapi({
      description: "Optional conversation ID for context tracking",
    }),
    contextLimit: z.number().int().positive().optional().default(10).openapi({
      description: "Optional limit for conversation history context",
    }),
    temperature: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .default(0.7)
      .openapi({ description: "Controls randomness (0-1)" }),
    maxTokens: z
      .number()
      .int()
      .positive()
      .optional()
      .default(4000)
      .openapi({ description: "Maximum tokens to generate" }),
    topP: z.number().min(0).max(1).optional().default(1.0).openapi({
      description: "Controls diversity via nucleus sampling (0-1)",
    }),
    frequencyPenalty: z
      .number()
      .min(0)
      .max(2)
      .optional()
      .default(0.0)
      .openapi({ description: "Penalizes repeated tokens (0-2)" }),
    presencePenalty: z
      .number()
      .min(0)
      .max(2)
      .optional()
      .default(0.0)
      .openapi({ description: "Penalizes tokens based on presence (0-2)" }),
    seed: z
      .number()
      .int()
      .optional()
      .openapi({ description: "Optional seed for reproducible results" }),
    stopSequences: z
      .array(z.string())
      .optional()
      .openapi({ description: "Stop sequences to end generation" }),
    extraOptions: z
      .record(z.string(), z.unknown())
      .optional()
      .openapi({ description: "Provider-specific options" }),
  })
  .passthrough();

// Content Part Schema for multimodal inputs
const ContentPartSchema = z.union([
  z
    .object({
      type: z.literal("text"),
      text: z.string(),
    })
    .openapi({ example: { type: "text", text: "Hello there!" } }),
  z
    .object({
      type: z.literal("image"),
      image: z.string().openapi({ description: "Base64 encoded image data or a URL" }),
      mimeType: z.string().optional().openapi({ example: "image/jpeg" }),
      alt: z.string().optional().openapi({ description: "Alternative text for the image" }),
    })
    .openapi({
      example: {
        type: "image",
        image: "data:image/png;base64,...",
        mimeType: "image/png",
      },
    }),
  z
    .object({
      type: z.literal("file"),
      data: z.string().openapi({ description: "Base64 encoded file data" }),
      filename: z.string().openapi({ example: "document.pdf" }),
      mimeType: z.string().openapi({ example: "application/pdf" }),
      size: z.number().optional().openapi({ description: "File size in bytes" }),
    })
    .openapi({
      example: {
        type: "file",
        data: "...",
        filename: "report.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    }),
]);

// Message Content Schema
const MessageContentSchema = z.union([
  z.string().openapi({ description: "Plain text content" }),
  z
    .array(ContentPartSchema)
    .openapi({ description: "An array of content parts (text, image, file)." }),
]);

// Message Object Schema
const MessageObjectSchema = z
  .object({
    role: z.enum(["system", "user", "assistant", "tool"]).openapi({
      description: "Role of the sender (e.g., 'user', 'assistant')",
    }),
    content: MessageContentSchema,
  })
  .openapi({ description: "A message object with role and content" });

// Text Generation Request Schema
export const TextRequestSchema = z
  .object({
    input: z.union([
      z.string().openapi({
        description: "Input text for the agent",
        example: "Tell me a joke!",
      }),
      z.array(MessageObjectSchema).openapi({
        description: "An array of message objects, representing the conversation history",
        example: [
          { role: "user", content: "What is the weather?" },
          { role: "assistant", content: "The weather is sunny." },
          { role: "user", content: [{ type: "text", text: "Thanks!" }] },
        ],
      }),
    ]),
    options: GenerateOptionsSchema.optional().openapi({
      description: "Optional generation parameters",
      example: {
        userId: "unique-user-id",
        conversationId: "unique-conversation-id",
        contextLimit: 10,
        temperature: 0.7,
        maxTokens: 100,
      },
    }),
  })
  .openapi("TextGenerationRequest");

// Text Generation Response Schema
export const TextResponseSchema = z.object({
  success: z.literal(true),
  data: z
    .object({
      provider: z.any().openapi({ description: "Provider-specific response details" }),
      text: z.string().openapi({ description: "Generated text content" }),
      usage: z
        .object({
          promptTokens: z.number(),
          completionTokens: z.number(),
          totalTokens: z.number(),
        })
        .optional()
        .openapi({ description: "Token usage information" }),
      toolCalls: z.array(z.any()).optional(),
      toolResults: z.array(z.any()).optional(),
      finishReason: z.string().optional(),
    })
    .passthrough()
    .openapi({ description: "Text generation response data" }),
});

// Object Generation Request Schema
export const ObjectRequestSchema = z
  .object({
    input: z.union([
      z.string().openapi({
        description: "Input text for object generation",
        example: "Extract user information from: John Doe, 30 years old, john@example.com",
      }),
      z.array(MessageObjectSchema).openapi({
        description: "An array of message objects for object generation",
      }),
    ]),
    schema: z.any().openapi({
      description: "JSON Schema or Zod schema defining the expected object structure",
      example: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
          email: { type: "string", format: "email" },
        },
        required: ["name", "age", "email"],
      },
    }),
    options: GenerateOptionsSchema.optional().openapi({
      description: "Optional generation parameters",
    }),
  })
  .openapi("ObjectGenerationRequest");

// Object Generation Response Schema
export const ObjectResponseSchema = z.object({
  success: z.literal(true),
  data: z
    .object({
      provider: z.any().openapi({ description: "Provider-specific response details" }),
      object: z.any().openapi({ description: "Generated object matching the requested schema" }),
      usage: z
        .object({
          promptTokens: z.number(),
          completionTokens: z.number(),
          totalTokens: z.number(),
        })
        .optional()
        .openapi({ description: "Token usage information" }),
      finishReason: z.string().optional(),
    })
    .passthrough()
    .openapi({ description: "Object generation response data" }),
});

// History Entry Schema
export const HistoryEntrySchema = z
  .object({
    id: z.string(),
    timestamp: z.string(),
    type: z.enum(["text", "object", "stream", "stream-object"]),
    input: z.any(),
    output: z.any(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .openapi({ description: "Agent conversation history entry" });

// Update Schemas
export const UpdateResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    hasUpdates: z.boolean(),
    updates: z.array(
      z.object({
        packageName: z.string(),
        currentVersion: z.string(),
        latestVersion: z.string(),
        updateType: z.enum(["major", "minor", "patch"]),
      }),
    ),
    count: z.number(),
  }),
});

export const UpdateActionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string(),
    updatedPackages: z.array(z.string()).optional(),
    packageName: z.string().optional(),
    updatedAt: z.string(),
  }),
});

// Count Response Schema
export const CountResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    count: z.number(),
  }),
});

// History Response Schema
export const HistoryResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(HistoryEntrySchema),
});
