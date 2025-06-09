import type { LocalAgentRegistry } from "@voltagent/core";
import type { ServerAdapter } from "../adapters/base";
import { ConsoleDataFormatter } from "../formatters/console";
import { WebSocketConnectionManager } from "../websocket";
import { generateLandingPageHtml } from "../html/landing-page";
import { validateCustomEndpoints } from "../custom-endpoints";
import type { VoltRouteOptions, RouteDefinition, RouteContext } from "../types";
import { routeDefinitions } from "./schemas";

/**
 * Factory to create VoltAgent routes for any server framework
 */
export class VoltRouteFactory {
  private formatter: ConsoleDataFormatter;
  private basePath: string;
  private webSocketManager: WebSocketConnectionManager;

  constructor(
    private registry: LocalAgentRegistry,
    private options: VoltRouteOptions = {},
  ) {
    this.formatter = new ConsoleDataFormatter();
    this.basePath = options.basePath || "";
    this.webSocketManager = new WebSocketConnectionManager(registry);
  }

  /**
   * Attach all VoltAgent routes to a server adapter
   */
  attachTo(adapter: ServerAdapter): void {
    // Register all OpenAPI-defined routes
    this.registerOpenAPIRoutes(adapter);

    // Add utility routes (landing page, etc.)
    this.addUtilityRoutes(adapter);

    // Custom endpoints
    if (this.options.customEndpoints) {
      this.addCustomEndpoints(adapter);
    }

    // WebSocket support if available
    if (adapter.addWebSocketHandler && this.options.enableWebSocket !== false) {
      this.addWebSocketRoutes(adapter);
    }
  }

  /**
   * Register all OpenAPI-defined routes
   */
  private registerOpenAPIRoutes(adapter: ServerAdapter): void {
    // Register each route definition
    for (const [name, routeDef] of Object.entries(routeDefinitions)) {
      const wrappedRoute: RouteDefinition = {
        ...routeDef,
        path: `${this.basePath}${routeDef.path}`,
        handler: this.wrapHandler(routeDef.handler),
      };

      // Check if it's a streaming route
      if (name.includes("stream") && adapter.addStreamingRoute) {
        adapter.addStreamingRoute(wrappedRoute);
      } else {
        adapter.addRoute(wrappedRoute);
      }
    }
  }

  /**
   * Wrap a route handler to inject registry and format responses
   */
  private wrapHandler(handler: Function) {
    return async (params: Record<string, any>, context: RouteContext) => {
      try {
        const result = await handler(params, context, this.registry);
        return this.formatter.formatSuccess(result);
      } catch (error) {
        console.error("Route handler error:", error);
        const message = error instanceof Error ? error.message : "An error occurred";

        // Check for specific error types
        if (message.includes("not found")) {
          throw { status: 404, message };
        }

        return this.formatter.formatError(message);
      }
    };
  }

  private addUtilityRoutes(adapter: ServerAdapter): void {
    // GET / - Landing page with comprehensive HTML
    const landingRoute: RouteDefinition = {
      method: "get",
      path: `${this.basePath}/`,
      handler: async () => {
        // Return HTML content for browser display
        return {
          contentType: "text/html",
          content: generateLandingPageHtml(),
        };
      },
      // Landing page doesn't have OpenAPI schema since it returns HTML
      openapi: {
        responses: {
          200: {
            description: "VoltAgent landing page",
          },
        },
        tags: ["Utility"],
        summary: "Landing page",
        description: "Display VoltAgent server landing page",
      },
    };

    adapter.addRoute(landingRoute);
  }

  private addWebSocketRoutes(adapter: ServerAdapter): void {
    if (!adapter.addWebSocketHandler) return;

    // WebSocket for agent updates - comprehensive implementation
    adapter.addWebSocketHandler(
      `${this.basePath}/ws/agents/:id`,
      async (connection, message, agentId) => {
        if (agentId) {
          // Add connection to manager
          this.webSocketManager.addConnection(agentId, connection);

          // Send initial agent state
          const initialState = await this.webSocketManager.getInitialAgentState(agentId);
          if (initialState) {
            try {
              connection.send(JSON.stringify(initialState));
            } catch (error) {
              console.error(`Failed to send initial state for agent ${agentId}:`, error);
            }
          }

          // Handle connection cleanup
          connection.on?.("close", () => {
            this.webSocketManager.removeConnection(agentId, connection);
          });

          connection.on?.("error", (error: any) => {
            console.error(`WebSocket error for agent ${agentId}:`, error);
            this.webSocketManager.removeConnection(agentId, connection);
          });
        }
      },
    );

    // General WebSocket test endpoint - comprehensive implementation
    adapter.addWebSocketHandler(`${this.basePath}/ws`, (connection, message) => {
      // Handle test connection
      this.webSocketManager.handleTestConnection(connection);

      // Handle messages
      connection.on?.("message", (data: any) => {
        this.webSocketManager.handleEchoMessage(connection, data);
      });

      connection.on?.("error", (error: any) => {
        console.error("WebSocket test connection error:", error);
      });
    });
  }

  /**
   * Get the WebSocket connection manager
   */
  getWebSocketManager(): WebSocketConnectionManager {
    return this.webSocketManager;
  }

  private addCustomEndpoints(adapter: ServerAdapter): void {
    if (!this.options.customEndpoints || this.options.customEndpoints.length === 0) {
      return;
    }

    try {
      // Validate all endpoints first (matches original)
      const validatedEndpoints = validateCustomEndpoints(this.options.customEndpoints);

      // Register each endpoint with the adapter
      for (const endpoint of validatedEndpoints) {
        const customRoute: RouteDefinition = {
          method: endpoint.method,
          path: `${this.basePath}${endpoint.path}`,
          handler: endpoint.handler,
          // Custom endpoints don't have OpenAPI schemas by default
        };
        adapter.addRoute(customRoute);
      }
    } catch (error) {
      // Match original error handling
      throw error;
    }
  }
}

/**
 * Convenience function to create VoltAgent routes
 */
export function createVoltRoutes(
  registry: LocalAgentRegistry,
  options?: VoltRouteOptions,
): VoltRouteFactory {
  return new VoltRouteFactory(registry, options);
}
