// Export all schemas
export * from "./types";

// Import route definitions
import {
  getAgentsRoute,
  getAgentByIdRoute,
  getAgentHistoryRoute,
  getAgentCountRoute,
} from "./agent-routes";

import {
  generateTextRoute,
  generateObjectRoute,
  streamTextRoute,
  streamObjectRoute,
} from "./generation-routes";

import { checkUpdatesRoute, updateAllRoute, updateSingleRoute } from "./update-routes";

/**
 * All route definitions with OpenAPI schemas
 */
export const routeDefinitions = {
  // Agent management routes
  getAgents: getAgentsRoute,
  getAgentById: getAgentByIdRoute,
  getAgentHistory: getAgentHistoryRoute,
  getAgentCount: getAgentCountRoute,

  // Generation routes
  generateText: generateTextRoute,
  generateObject: generateObjectRoute,
  streamText: streamTextRoute,
  streamObject: streamObjectRoute,

  // Update routes
  checkUpdates: checkUpdatesRoute,
  updateAll: updateAllRoute,
  updateSingle: updateSingleRoute,
};

// Export individual routes for convenience
export {
  getAgentsRoute,
  getAgentByIdRoute,
  getAgentHistoryRoute,
  getAgentCountRoute,
  generateTextRoute,
  generateObjectRoute,
  streamTextRoute,
  streamObjectRoute,
  checkUpdatesRoute,
  updateAllRoute,
  updateSingleRoute,
};
