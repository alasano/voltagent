import { z } from "zod";
import type { RouteHandler, HttpMethod } from "./types";

/**
 * Schema for validating custom endpoint definitions
 * Matches the original implementation exactly
 */
export const CustomEndpointSchema = z.object({
  path: z.string().startsWith("/"),
  method: z.enum(["get", "post", "put", "patch", "delete", "options", "head"]),
  handler: z.function().args(z.any()).returns(z.any()),
  description: z.string().optional(),
});

/**
 * Definition for a custom endpoint
 * Matches the original interface
 */
export interface CustomEndpointDefinition {
  /**
   * The path for the endpoint, relative to the API root
   * Example: "/custom-endpoint" or "/custom/:param"
   */
  path: string;

  /**
   * The HTTP method for the endpoint
   */
  method: HttpMethod;

  /**
   * The handler function for the endpoint
   */
  handler: RouteHandler;

  /**
   * Optional description for the endpoint
   */
  description?: string;
}

/**
 * Error thrown when a custom endpoint definition is invalid
 * Matches the original error class
 */
export class CustomEndpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomEndpointError";
  }
}

/**
 * Validates a custom endpoint definition
 * @param endpoint The endpoint definition to validate
 * @returns The validated endpoint definition
 * @throws CustomEndpointError if the endpoint definition is invalid
 */
export function validateCustomEndpoint(
  endpoint: CustomEndpointDefinition,
): CustomEndpointDefinition {
  try {
    return CustomEndpointSchema.parse(endpoint);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new CustomEndpointError(`Invalid custom endpoint definition: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validates an array of custom endpoint definitions
 * @param endpoints The endpoint definitions to validate
 * @returns The validated endpoint definitions
 * @throws CustomEndpointError if any endpoint definition is invalid
 */
export function validateCustomEndpoints(
  endpoints: CustomEndpointDefinition[],
): CustomEndpointDefinition[] {
  if (!endpoints || !Array.isArray(endpoints)) {
    throw new CustomEndpointError("Custom endpoints must be an array");
  }

  if (endpoints.length === 0) {
    return [];
  }

  // Validate each endpoint
  const validatedEndpoints: CustomEndpointDefinition[] = [];
  for (const endpoint of endpoints) {
    try {
      validatedEndpoints.push(validateCustomEndpoint(endpoint));
    } catch (error) {
      if (error instanceof CustomEndpointError) {
        throw error;
      }
      throw new CustomEndpointError(
        `Failed to validate custom endpoint: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return validatedEndpoints;
}
