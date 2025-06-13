import type { AgentHistoryEntry } from "@voltagent/core";
import type { z } from "zod";
import type { CustomEndpointDefinition } from "./custom-endpoints";

export type { CustomEndpointDefinition };

/**
 * Server configuration options for VoltAgent
 */
export interface ServerOptions {
  /**
   * Whether to automatically start the server
   * @default true
   */
  autoStart?: boolean;
  /**
   * Port number for the server
   * @default 3141 (or next available port)
   */
  port?: number;
  /**
   * Optional flag to enable/disable Swagger UI
   * By default:
   * - In development (NODE_ENV !== 'production'): Swagger UI is enabled
   * - In production (NODE_ENV === 'production'): Swagger UI is disabled
   */
  enableSwaggerUI?: boolean;
  /**
   * Optional array of custom endpoint definitions to register with the API server
   */
  customEndpoints?: CustomEndpointDefinition[];
}

/**
 * HTTP methods supported by server adapters
 */
export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "options" | "head";

/**
 * Generic route handler context
 */
export interface RouteContext {
  params: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
  user?: any;
  [key: string]: any;
}

/**
 * Route handler function
 */
export type RouteHandler = (
  params: Record<string, any>,
  context: RouteContext,
  registry?: any,
) => Promise<any> | any;

/**
 * Streaming route handler function for SSE (Server-Sent Events)
 */
export type StreamingRouteHandler = (
  params: Record<string, any>,
  context: RouteContext,
) => Promise<ReadableStream | any> | ReadableStream | any;

/**
 * WebSocket message handler
 */
export type WebSocketHandler = (
  connection: any,
  message: any,
  agentId?: string,
) => Promise<void> | void;

/**
 * Console agent list format
 */
export interface ConsoleAgentSummary {
  id: string;
  name: string;
  description: string;
  status: string;
  model: string;
  tools: any[];
  subAgents?: ConsoleAgentSummary[];
  memory?: any;
  isTelemetryEnabled: boolean;
}

/**
 * Console agent detail format
 */
export interface ConsoleAgentDetail {
  id: string;
  name: string;
  description: string;
  instructions: string;
  status: string;
  model: string;
  tools: any[];
  subAgents: any[];
  memory: any;
  retriever?: any;
  isTelemetryEnabled: boolean;
  node_id: string;
}

/**
 * Console history format
 */
export interface ConsoleHistoryEntry {
  id: string;
  input: any;
  output: any;
  status: string;
  startTime: string | Date;
  endTime?: string | Date;
  steps?: any[];
  usage?: any;
}

/**
 * VoltAgent route options
 */
export interface VoltRouteOptions {
  basePath?: string;
  enableWebSocket?: boolean;
  customEndpoints?: CustomEndpointDefinition[];
}

/**
 * API response format
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Type alias matching Hono's exact RouteParameter definition
type RouteParameter = z.AnyZodObject | z.ZodEffects<z.AnyZodObject, unknown, unknown> | undefined;

// Type alias matching Hono's ZodRequestBody definition
interface ZodRequestBody {
  description?: string;
  content: {
    "application/json": {
      schema: z.ZodType<unknown>;
    };
  };
  required?: boolean;
}

/**
 * OpenAPI route request definition - matches Hono's RouteConfig exactly
 */
export interface OpenAPIRequest {
  params?: RouteParameter;
  query?: RouteParameter;
  body?: ZodRequestBody;
  headers?: RouteParameter | z.ZodType<unknown>[];
  cookies?: RouteParameter;
}

/**
 * OpenAPI route response definition - matches Hono's RouteConfig
 */
export interface OpenAPIResponse {
  description: string;
  content?:
    | {
        "application/json": {
          schema: z.ZodType<any>;
        };
      }
    | {
        "text/event-stream": {
          schema: z.ZodType<any>;
        };
      };
}

/**
 * OpenAPI metadata for routes
 */
export interface OpenAPIMetadata {
  request?: OpenAPIRequest;
  responses: Record<number, OpenAPIResponse>;
  tags?: string[];
  summary?: string;
  description?: string;
}

/**
 * OpenAPI-aware route definition
 */
export interface RouteDefinition<TParams = any, TBody = any, TResponse = any> {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  openapi?: OpenAPIMetadata;
}
