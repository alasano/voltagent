import type { Agent } from "./agent";
import { LocalAgentRegistry } from "./registry/local";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";
import type { VoltAgentExporter } from "./telemetry/exporter";
import devLogger from "./utils/internal/dev-logger";

export { devLogger };

export * from "./agent";
export * from "./agent/hooks";
export * from "./tool";
export * from "./tool/reasoning/index";
export * from "./memory";
export * from "./agent/providers";
export * from "./events/types";
export { AgentEventEmitter } from "./events";
export type {
  AgentOptions,
  AgentResponse,
  AgentStatus,
  ModelToolCall,
  OperationContext,
  ToolExecutionContext,
  VoltAgentError,
  StreamTextFinishResult,
  StreamTextOnFinishCallback,
  StreamObjectFinishResult,
  StreamObjectOnFinishCallback,
  ToolErrorInfo,
} from "./agent/types";
export type { AgentHistoryEntry, HistoryStatus } from "./agent/history";
export type { AgentHooks } from "./agent/hooks";
export * from "./types";
export * from "./utils";
export * from "./retriever";
export * from "./mcp";
export { LocalAgentRegistry } from "./registry/local";
export * from "./utils/update";
export { createAsyncIterableStream, type AsyncIterableStream } from "./utils/async-iterable-stream";
export * from "./voice";
export * from "./telemetry/exporter";
export type { UsageInfo } from "./agent/providers";

// Minimal type definitions for legacy API compatibility only
// These are NOT imported by server packages - they have their own definitions

// Local ServerOptions type for VoltAgentOptions
interface ServerOptions {
  autoStart?: boolean;
  port?: number;
  enableSwaggerUI?: boolean;
  customEndpoints?: LegacyCustomEndpointDefinition[];
}

interface LegacyCustomEndpointDefinition {
  path: string;
  method: "get" | "post" | "put" | "patch" | "delete" | "options" | "head";
  handler: (...args: any[]) => any | Promise<any>;
  description?: string;
}

// Global store for custom endpoints (for legacy API compatibility)
const globalCustomEndpoints: LegacyCustomEndpointDefinition[] = [];

/**
 * Register custom endpoints globally (for legacy VoltAgent compatibility)
 * @deprecated Use customEndpoints option in createVoltServer from @voltagent/server instead
 * @param endpoints Array of custom endpoint definitions
 */
export function registerCustomEndpoints(endpoints: LegacyCustomEndpointDefinition[]): void {
  globalCustomEndpoints.push(...endpoints);
}

// Export for internal use by server packages
export { globalCustomEndpoints as _globalCustomEndpoints };

// This is the full definition of the options for the DEPRECATED VoltAgent class.
// It's defined here to support the legacy constructor signature.
// It includes types that will be dynamically imported.
type VoltAgentOptions = {
  agents: Record<string, Agent<any>>;
  /**
   * Server configuration options
   */
  server?: ServerOptions;
  /**
   * @deprecated Use `server.port` instead
   */
  port?: number;
  /**
   * @deprecated Use `server.autoStart` instead
   */
  autoStart?: boolean;
  checkDependencies?: boolean;
  /**
   * @deprecated Use `server.customEndpoints` instead
   */
  customEndpoints?: LegacyCustomEndpointDefinition[];
  /**
   * @deprecated Use `server.enableSwaggerUI` instead
   */
  enableSwaggerUI?: boolean;
  telemetryExporter?: (SpanExporter | VoltAgentExporter) | (SpanExporter | VoltAgentExporter)[];
  serverMode?: "auto" | "manual" | "disabled";
  registry?: LocalAgentRegistry; // Legacy option, now handled by server packages.
};
/**
 * @deprecated The VoltAgent class is deprecated and will be removed in v2.0. Please use the new `createVoltServer` function from `@voltagent/server` or your chosen server adapter.
 */
export class VoltAgent {
  private serverMode: "auto" | "manual" | "disabled";
  private registry: LocalAgentRegistry;
  private _isLegacyMode: boolean;
  private serverOptions: ServerOptions = {};

  constructor(options: VoltAgentOptions) {
    this.serverMode = options.serverMode ?? "auto";
    // The concept of a singleton registry is gone. In legacy mode, we just create a local one.
    this.registry = options.registry || new LocalAgentRegistry();
    this._isLegacyMode = this.serverMode === "auto";

    // Merge server options with backward compatibility
    // New server object takes precedence over deprecated individual options
    this.serverOptions = {
      autoStart: options.server?.autoStart ?? options.autoStart ?? true,
      port: options.server?.port ?? options.port,
      enableSwaggerUI: options.server?.enableSwaggerUI ?? options.enableSwaggerUI,
      customEndpoints: options.server?.customEndpoints ?? options.customEndpoints ?? [],
    };

    // Register agents if provided
    if (options.agents) {
      Object.values(options.agents).forEach((agent) => {
        this.registry.registerAgent(agent);
      });
    }

    if (this.serverMode === "auto" && this.serverOptions.autoStart !== false) {
      devLogger.warn(
        "[DEPRECATION] Automatic server startup via 'new VoltAgent()' is deprecated and will be removed in v2.0. Please migrate to the new 'createVoltServer' API from '@voltagent/server'.",
      );

      this.startLegacyServer(options).catch((err) => {
        devLogger.error("Failed to start legacy server:", err);
      });
    }
  }

  private async startLegacyServer(options: VoltAgentOptions): Promise<void> {
    try {
      // Dynamically import the server package ONLY when needed.
      // @ts-ignore - This is a dynamic import of an optional peer dependency.
      const { _startLegacyHonoServer } = await import("@voltagent/server");

      // Delegate the entire startup process to a dedicated function
      // in the server package.
      await _startLegacyHonoServer(options);
    } catch (error: any) {
      if (error.code === "MODULE_NOT_FOUND") {
        throw new Error(
          "To use the automatic server, you must install the default server: 'npm install @voltagent/server'",
        );
      }
    }
  }

  /**
   * Register an agent
   */
  public registerAgent(agent: Agent<any>): void {
    // Register the main agent
    this.registry.registerAgent(agent);

    // Also register all subagents recursively
    const subAgents = agent.getSubAgents();
    if (subAgents && subAgents.length > 0) {
      subAgents.forEach((subAgent) => this.registerAgent(subAgent));
    }
  }

  /**
   * Register multiple agents
   */
  public registerAgents(agents: Record<string, Agent<any>>): void {
    Object.values(agents).forEach((agent) => this.registerAgent(agent));
  }

  public getServerMode(): "auto" | "manual" | "disabled" {
    return this.serverMode;
  }

  public isLegacyMode(): boolean {
    // In the refactored code, legacy mode is determined by whether a registry was passed to the constructor.
    // The constructor logic for this needs to be updated.
    return this._isLegacyMode;
  }

  public getRegistry(): any {
    return this.registry;
  }

  public getAgentCount(): number {
    return this.registry.getAgentCount();
  }

  public getAgent(id: string): Agent<any> | undefined {
    return this.registry.getAgent(id);
  }

  public getAgents(): Agent<any>[] {
    return this.registry.getAllAgents();
  }
}

export default VoltAgent;
