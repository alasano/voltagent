import type {
  HttpMethod,
  RouteHandler,
  WebSocketHandler,
  StreamingRouteHandler,
  RouteDefinition,
} from "../types";

/**
 * Base server adapter interface
 * Framework-specific implementations should extend this class
 */
export abstract class ServerAdapter {
  /**
   * Track registered routes for documentation
   */
  protected registeredRoutes: RouteDefinition[] = [];

  /**
   * Add a route to the server (with optional OpenAPI support)
   */
  abstract addRoute(route: RouteDefinition): void;

  /**
   * Legacy method for backward compatibility
   */
  addSimpleRoute(path: string, method: HttpMethod, handler: RouteHandler): void {
    this.addRoute({
      path,
      method,
      handler,
    });
  }

  /**
   * Add a streaming route (SSE) to the server
   * Framework-specific implementation required for streaming
   */
  addStreamingRoute?(route: RouteDefinition): void;

  /**
   * Legacy streaming route for backward compatibility
   */
  addSimpleStreamingRoute?(path: string, method: HttpMethod, handler: StreamingRouteHandler): void {
    if (this.addStreamingRoute) {
      this.addStreamingRoute({
        path,
        method,
        handler,
      });
    }
  }

  /**
   * Add WebSocket handler (optional for adapters that support WebSocket)
   */
  addWebSocketHandler?(path: string, handler: WebSocketHandler): void;

  /**
   * Get all registered routes (for documentation)
   */
  getRegisteredRoutes(): RouteDefinition[] {
    return this.registeredRoutes;
  }
}
