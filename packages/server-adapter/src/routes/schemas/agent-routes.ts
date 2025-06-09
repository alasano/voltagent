import type { LocalAgentRegistry } from "@voltagent/core";
import type { RouteDefinition } from "../../types";
import {
  ParamsSchema,
  ErrorSchema,
  AgentResponseSchema,
  CountResponseSchema,
  HistoryResponseSchema,
} from "./types";
import { z } from "@hono/zod-openapi";

/**
 * GET /agents - List all agents
 */
export const getAgentsRoute: RouteDefinition = {
  method: "get",
  path: "/agents",
  openapi: {
    responses: {
      200: {
        description: "List of all registered agents",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal(true),
              data: z.array(AgentResponseSchema),
            }),
          },
        },
      },
      500: {
        description: "Server error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
    tags: ["Agent Management"],
    summary: "List all agents",
    description:
      "Retrieve a list of all registered agents with their current status and configuration",
  },
  handler: async (params, context, registry: LocalAgentRegistry) => {
    const agents = registry.getAllAgents();
    const agentDataArray = agents.map((agent) => {
      const fullState = agent.getFullState();
      const isTelemetryEnabled = agent.isTelemetryConfigured();
      return {
        id: fullState.id,
        name: fullState.name,
        description: fullState.description,
        status: fullState.status,
        model: fullState.model,
        tools: agent.getToolsForApi() as any,
        subAgents:
          fullState.subAgents?.map((subAgent: any) => ({
            id: subAgent.id || "",
            name: subAgent.name || "",
            description: subAgent.description || "",
            status: subAgent.status || "idle",
            model: subAgent.model || "",
            tools: subAgent.tools || [],
            memory: subAgent.memory,
          })) || [],
        memory: fullState.memory as any,
        isTelemetryEnabled,
      };
    });
    return agentDataArray;
  },
};

/**
 * GET /agents/:id - Get agent details
 */
export const getAgentByIdRoute: RouteDefinition = {
  method: "get",
  path: "/agents/{id}",
  openapi: {
    request: {
      params: ParamsSchema,
    },
    responses: {
      200: {
        description: "Agent details",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal(true),
              data: AgentResponseSchema,
            }),
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
    tags: ["Agent Management"],
    summary: "Get agent by ID",
    description: "Retrieve detailed information about a specific agent",
  },
  handler: async (params, context, registry: LocalAgentRegistry) => {
    const agent = registry.getAgent(params.id);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const fullState = agent.getFullState();
    const isTelemetryEnabled = agent.isTelemetryConfigured();

    return {
      id: fullState.id,
      name: fullState.name,
      description: fullState.description,
      status: fullState.status,
      model: fullState.model,
      tools: agent.getToolsForApi() as any,
      subAgents:
        fullState.subAgents?.map((subAgent: any) => ({
          id: subAgent.id || "",
          name: subAgent.name || "",
          description: subAgent.description || "",
          status: subAgent.status || "idle",
          model: subAgent.model || "",
          tools: subAgent.tools || [],
          memory: subAgent.memory,
        })) || [],
      memory: fullState.memory as any,
      isTelemetryEnabled,
    };
  },
};

/**
 * GET /agents/:id/history - Get agent history
 */
export const getAgentHistoryRoute: RouteDefinition = {
  method: "get",
  path: "/agents/{id}/history",
  openapi: {
    request: {
      params: ParamsSchema,
    },
    responses: {
      200: {
        description: "Agent conversation history",
        content: {
          "application/json": {
            schema: HistoryResponseSchema,
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
    tags: ["Agent Management"],
    summary: "Get agent history",
    description: "Retrieve the conversation history for a specific agent",
  },
  handler: async (params, context, registry: LocalAgentRegistry) => {
    const agent = registry.getAgent(params.id);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const history = await agent.getHistory();
    return history;
  },
};

/**
 * GET /agents/count - Get agent count
 */
export const getAgentCountRoute: RouteDefinition = {
  method: "get",
  path: "/agents/count",
  openapi: {
    responses: {
      200: {
        description: "Total number of registered agents",
        content: {
          "application/json": {
            schema: CountResponseSchema,
          },
        },
      },
    },
    tags: ["Agent Management"],
    summary: "Get agent count",
    description: "Get the total number of registered agents",
  },
  handler: async (params, context, registry: LocalAgentRegistry) => {
    const count = registry.getAgentCount();
    return { count };
  },
};
