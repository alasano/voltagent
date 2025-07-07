import type { ClientCapabilities } from "@modelcontextprotocol/sdk/types.js";
import type { Tool } from "../tool";

/**
 * Client information for MCP
 */
export interface ClientInfo {
  /**
   * Client name
   */
  name: string;

  /**
   * Client version
   */
  version: string;

  /**
   * Allow additional properties for SDK compatibility
   */
  [key: string]: unknown;
}

/**
 * Transport error from MCP
 */
export interface TransportError extends Error {
  /**
   * Error code
   */
  code?: string;

  /**
   * Error details
   */
  details?: unknown;
}

/**
 * Model Context Protocol (MCP) configuration options
 */
export type MCPOptions = {
  /**
   * Whether MCP is enabled
   */
  enabled: boolean;

  /**
   * MCP API endpoint
   */
  endpoint?: string;

  /**
   * API key for MCP authentication
   */
  apiKey?: string;

  /**
   * Control parameters for MCP
   */
  controlParams?: Record<string, unknown>;

  /**
   * Whether to fall back to the provider if MCP fails
   */
  fallbackToProvider?: boolean;

  /**
   * Timeout in milliseconds for MCP requests
   * @default 30000
   */
  timeout?: number;
};

/**
 * Configuration for MCP client
 */
export type MCPClientConfig = {
  /**
   * Client information
   */
  clientInfo: ClientInfo;

  /**
   * MCP server configuration
   */
  server: MCPServerConfig;

  /**
   * MCP capabilities
   */
  capabilities?: ClientCapabilities;

  /**
   * Timeout in milliseconds for MCP requests
   * @default 30000
   */
  timeout?: number;
};

/**
 * MCP server configuration options
 */
export type MCPServerConfig =
  | HTTPServerConfig
  | SSEServerConfig
  | StreamableHTTPServerConfig
  | StdioServerConfig;

/**
 * HTTP-based MCP server configuration with automatic fallback
 * Tries streamable HTTP first, falls back to SSE if not supported
 */
export type HTTPServerConfig = {
  /**
   * Type of server connection
   */
  type: "http";

  /**
   * URL of the MCP server
   */
  url: string;

  /**
   * Request initialization options
   */
  requestInit?: RequestInit;

  /**
   * Event source initialization options (used for SSE fallback)
   */
  eventSourceInit?: EventSourceInit;
};

/**
 * SSE-based MCP server configuration (explicit SSE transport)
 */
export type SSEServerConfig = {
  /**
   * Type of server connection
   */
  type: "sse";

  /**
   * URL of the MCP server
   */
  url: string;

  /**
   * Request initialization options
   */
  requestInit?: RequestInit;

  /**
   * Event source initialization options
   */
  eventSourceInit?: EventSourceInit;
};

/**
 * Streamable HTTP-based MCP server configuration (no fallback)
 */
export type StreamableHTTPServerConfig = {
  /**
   * Type of server connection
   */
  type: "streamable-http";

  /**
   * URL of the MCP server
   */
  url: string;

  /**
   * Request initialization options
   */
  requestInit?: RequestInit;

  /**
   * Session ID for the connection
   */
  sessionId?: string;
};

/**
 * Stdio-based MCP server configuration
 */
export type StdioServerConfig = {
  /**
   * Type of server connection
   */
  type: "stdio";

  /**
   * Command to run the MCP server
   */
  command: string;

  /**
   * Arguments to pass to the command
   */
  args?: string[];

  /**
   * Environment variables for the MCP server process
   */
  env?: Record<string, string>;

  /**
   * Working directory for the MCP server process
   */
  cwd?: string;
};

/**
 * Tool call request
 */
export type MCPToolCall = {
  /**
   * Name of the tool to call
   */
  name: string;

  /**
   * Arguments to pass to the tool
   */
  arguments: Record<string, unknown>;
};

/**
 * Tool call result
 */
export type MCPToolResult = {
  /**
   * Result content from the tool
   */
  content: unknown;
};

/**
 * MCP client events
 */
export interface MCPClientEvents {
  /**
   * Emitted when the client connects to the server
   */
  connect: () => void;

  /**
   * Emitted when the client disconnects from the server
   */
  disconnect: () => void;

  /**
   * Emitted when an error occurs
   */
  error: (error: Error | TransportError) => void;

  /**
   * Emitted when a tool call completes
   */
  toolCall: (name: string, args: Record<string, unknown>, result: unknown) => void;
}

/**
 * Map of toolset names to tools
 */
export type ToolsetMap = Record<string, ToolsetWithTools>;

/**
 * A record of tools along with a helper method to convert them to an array.
 */
export type ToolsetWithTools = Record<string, AnyToolConfig> & {
  /**
   * Converts the toolset to an array of BaseTool objects.
   */
  getTools: () => Tool<any>[];
};

/**
 * Any tool configuration
 */
export type AnyToolConfig = Tool<any>;
