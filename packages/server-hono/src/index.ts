import {
  Agent,
  type AgentOptions,
  LocalAgentRegistry,
  type VoltAgentExporter,
  checkForUpdates,
  devLogger,
  _globalCustomEndpoints,
} from "@voltagent/core";
import type { CustomEndpointDefinition } from "@voltagent/server-adapter";
import { BatchSpanProcessor, type SpanExporter } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { HonoVoltServer } from "./server";

// Main server class (for advanced use)
export { HonoVoltServer, startHonoServer, type HonoServerOptions, type ServerInfo } from "./server";

// Adapter
export { HonoServerAdapter } from "./adapters/hono";

// WebSocket utilities
export { createWebSocketServer, broadcastToAgent, broadcastToAll } from "./server/websocket";

// A more robust AgentDefinition that handles the generic provider type.
type AgentDefinition<TProvider extends { llm: any }> = Omit<AgentOptions, "registry"> &
  TProvider & { model: any };

interface CreateServerOptions {
  agents: AgentDefinition<any>[];
  port?: number;
  customEndpoints?: CustomEndpointDefinition[];
  telemetryExporter?: VoltAgentExporter | (SpanExporter | VoltAgentExporter)[];
  checkDependencies?: boolean;
}

/**
 * Creates and configures a new Hono-based Volt server.
 * This is the recommended way to start a Volt server.
 */
export function createVoltServer(options: CreateServerOptions) {
  if (options.checkDependencies !== false) {
    checkForUpdates(undefined, { filter: "@voltagent" })
      .then((result) => {
        if (result.hasUpdates) {
          devLogger.info(`\n${result.message}\nRun 'volt update' to get the latest features.`);
        }
      })
      .catch((err) => devLogger.error("Error checking for updates:", err));
  }

  if (options.telemetryExporter) {
    initializeGlobalTelemetry(options.telemetryExporter);
  }

  const registry = new LocalAgentRegistry();

  const agentInstances = options.agents.map((agentDef) => {
    const agent = new Agent({
      ...agentDef,
      registry: registry,
    });

    if (
      options.telemetryExporter &&
      typeof (agent as any)._INTERNAL_setVoltAgentExporter === "function"
    ) {
      const voltExporter = Array.isArray(options.telemetryExporter)
        ? options.telemetryExporter.find(
            (exp): exp is VoltAgentExporter =>
              typeof (exp as VoltAgentExporter).exportHistoryEntry === "function",
          )
        : (options.telemetryExporter as VoltAgentExporter);
      if (voltExporter) {
        (agent as any)._INTERNAL_setVoltAgentExporter(voltExporter);
      }
    }
    return agent;
  });

  agentInstances.forEach((instance) => registry.registerAgent(instance));

  const server = new HonoVoltServer(registry, {
    port: options.port,
    customEndpoints: options.customEndpoints,
  });

  return {
    start: () => server.start(),
    stop: () => server.stop(),
    getInstance: () => server,
    registry,
  };
}

/**
 * @internal
 * For backward compatibility with the deprecated VoltAgent class.
 */
export async function _startLegacyHonoServer(options: any): Promise<void> {
  if (options.checkDependencies !== false) {
    checkForUpdates(undefined, { filter: "@voltagent" })
      .then((result) => {
        if (result.hasUpdates) {
          devLogger.info(`\n${result.message}\nRun 'volt update' to get the latest features.`);
        }
      })
      .catch((err) => devLogger.error("Error checking for updates:", err));
  }

  if (options.telemetryExporter) {
    initializeGlobalTelemetry(options.telemetryExporter);
  }

  const registry = new LocalAgentRegistry();

  if (options.agents) {
    Object.values(options.agents).forEach((agentInstance: any) => {
      (agentInstance as any).registry = registry;
      registry.registerAgent(agentInstance);
    });
  }

  if (options.telemetryExporter) {
    const voltExporter = Array.isArray(options.telemetryExporter)
      ? options.telemetryExporter[0]
      : options.telemetryExporter;
    registry.getAllAgents().forEach((agent: any) => {
      if (typeof agent._INTERNAL_setVoltAgentExporter === "function") {
        agent._INTERNAL_setVoltAgentExporter(voltExporter);
      }
    });
  }

  // Combine custom endpoints from both sources for legacy compatibility
  const allCustomEndpoints = [...(options.customEndpoints || []), ..._globalCustomEndpoints];

  const server = new HonoVoltServer(registry, {
    port: options.port,
    customEndpoints: allCustomEndpoints.length > 0 ? allCustomEndpoints : undefined,
  });

  await server.start();
}

let isTelemetryInitialized = false;
function initializeGlobalTelemetry(exporters: any) {
  if (isTelemetryInitialized) {
    devLogger.warn("Telemetry is already initialized. Skipping re-initialization.");
    return;
  }
  const spanExporters = (Array.isArray(exporters) ? exporters : [exporters]).filter(
    (exp: any): exp is SpanExporter => exp.export !== undefined,
  );
  if (spanExporters.length > 0) {
    const provider = new NodeTracerProvider({
      spanProcessors: spanExporters.map((exporter) => new BatchSpanProcessor(exporter)),
    });
    provider.register();
    isTelemetryInitialized = true;
  }
}
