import type { LocalAgentRegistry } from "@voltagent/core";
import { checkForUpdates, updateAllPackages, updateSinglePackage } from "@voltagent/core";
import type { RouteDefinition } from "../../types";
import { ErrorSchema, UpdateResponseSchema, UpdateActionResponseSchema } from "./types";
import { z } from "@hono/zod-openapi";

/**
 * GET /updates - Check for package updates
 */
export const checkUpdatesRoute: RouteDefinition = {
  method: "get",
  path: "/updates",
  openapi: {
    responses: {
      200: {
        description: "Update check results",
        content: {
          "application/json": {
            schema: UpdateResponseSchema,
          },
        },
      },
      500: {
        description: "Failed to check for updates",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
    tags: ["System Management"],
    summary: "Check for updates",
    description: "Check for available updates to VoltAgent packages",
  },
  handler: async () => {
    const updates = await checkForUpdates();
    return {
      hasUpdates: updates.hasUpdates,
      updates: updates.updates,
      count: updates.count,
    };
  },
};

/**
 * POST /updates - Update all packages
 */
export const updateAllRoute: RouteDefinition = {
  method: "post",
  path: "/updates",
  openapi: {
    responses: {
      200: {
        description: "Update completed successfully",
        content: {
          "application/json": {
            schema: UpdateActionResponseSchema,
          },
        },
      },
      500: {
        description: "Update failed",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
    tags: ["System Management"],
    summary: "Update all packages",
    description: "Update all VoltAgent packages to their latest versions",
  },
  handler: async () => {
    const result = await updateAllPackages();
    return {
      message: result.message,
      updatedPackages: result.updatedPackages || [],
      updatedAt: new Date().toISOString(),
    };
  },
};

/**
 * Package name parameter schema
 */
const PackageParamsSchema = z.object({
  packageName: z.string().openapi({
    param: { name: "packageName", in: "path" },
    description: "The name of the package to update",
    example: "@voltagent/core",
  }),
});

/**
 * POST /updates/:packageName - Update single package
 */
export const updateSingleRoute: RouteDefinition = {
  method: "post",
  path: "/updates/{packageName}",
  openapi: {
    request: {
      params: PackageParamsSchema,
    },
    responses: {
      200: {
        description: "Package updated successfully",
        content: {
          "application/json": {
            schema: UpdateActionResponseSchema,
          },
        },
      },
      500: {
        description: "Update failed",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
    tags: ["System Management"],
    summary: "Update single package",
    description: "Update a specific VoltAgent package to its latest version",
  },
  handler: async (params) => {
    const result = await updateSinglePackage(params.packageName);
    return {
      message: result.message,
      packageName: result.packageName,
      updatedAt: new Date().toISOString(),
    };
  },
};
