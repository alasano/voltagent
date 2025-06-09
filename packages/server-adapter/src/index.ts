// Base adapter
export { ServerAdapter } from "./adapters/base";

// Data formatters
export { ConsoleDataFormatter } from "./formatters/console";

// Route factory
export { VoltRouteFactory, createVoltRoutes } from "./routes/factory";

// WebSocket utilities
export { WebSocketConnectionManager, extractAgentIdFromUrl, isTestWebSocketUrl } from "./websocket";

// Utilities
export { generateLandingPageHtml } from "./html/landing-page";

// Custom endpoints
export {
  CustomEndpointError,
  CustomEndpointSchema,
  validateCustomEndpoint,
  validateCustomEndpoints,
} from "./custom-endpoints";

// Types
export type {
  HttpMethod,
  RouteContext,
  RouteHandler,
  StreamingRouteHandler,
  WebSocketHandler,
  RouteDefinition,
  OpenAPIRequest,
  OpenAPIResponse,
  OpenAPIMetadata,
  ConsoleAgentSummary,
  ConsoleAgentDetail,
  ConsoleHistoryEntry,
  VoltRouteOptions,
  ApiResponse,
} from "./types";

export type { CustomEndpointDefinition } from "./custom-endpoints";
