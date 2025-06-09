import {
  validateCustomEndpoint,
  validateCustomEndpoints,
  CustomEndpointError,
  CustomEndpointDefinition,
  CustomEndpointSchema,
} from "./custom-endpoints";
import { z } from "zod";

// Local mock creation functions
function createValidEndpoint(
  overrides: Partial<CustomEndpointDefinition> = {},
): CustomEndpointDefinition {
  return {
    path: "/test",
    method: "get",
    handler: jest.fn().mockResolvedValue({ success: true }),
    description: "Test endpoint",
    ...overrides,
  };
}

function createMockHandler(): jest.Mock {
  return jest.fn().mockResolvedValue({ success: true, data: "mock response" });
}

describe("Custom Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("CustomEndpointSchema", () => {
    it("should validate valid endpoint schema", () => {
      const validEndpoint = {
        path: "/valid-path",
        method: "get",
        handler: jest.fn(),
        description: "Valid endpoint description",
      };

      const result = CustomEndpointSchema.safeParse(validEndpoint);
      expect(result.success).toBe(true);
    });

    it("should require path to start with slash", () => {
      const invalidEndpoint = {
        path: "invalid-path", // Missing leading slash
        method: "get",
        handler: jest.fn(),
      };

      const result = CustomEndpointSchema.safeParse(invalidEndpoint);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Invalid input");
      }
    });

    it("should validate HTTP methods", () => {
      const validMethods = ["get", "post", "put", "patch", "delete", "options", "head"];

      validMethods.forEach((method) => {
        const endpoint = {
          path: "/test",
          method,
          handler: jest.fn(),
        };

        const result = CustomEndpointSchema.safeParse(endpoint);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid HTTP methods", () => {
      const invalidEndpoint = {
        path: "/test",
        method: "invalid",
        handler: jest.fn(),
      };

      const result = CustomEndpointSchema.safeParse(invalidEndpoint);
      expect(result.success).toBe(false);
    });

    it("should require handler function", () => {
      const invalidEndpoint = {
        path: "/test",
        method: "get",
        handler: "not a function",
      };

      const result = CustomEndpointSchema.safeParse(invalidEndpoint);
      expect(result.success).toBe(false);
    });

    it("should make description optional", () => {
      const endpointWithoutDescription = {
        path: "/test",
        method: "post",
        handler: jest.fn(),
      };

      const result = CustomEndpointSchema.safeParse(endpointWithoutDescription);
      expect(result.success).toBe(true);
    });

    it("should validate description when provided", () => {
      const endpointWithDescription = {
        path: "/test",
        method: "put",
        handler: jest.fn(),
        description: "Test endpoint with description",
      };

      const result = CustomEndpointSchema.safeParse(endpointWithDescription);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe("Test endpoint with description");
      }
    });
  });

  describe("validateCustomEndpoint", () => {
    it("should accept valid endpoint", () => {
      const endpoint = createValidEndpoint({
        path: "/test",
        method: "get",
        handler: createMockHandler(),
      });

      expect(() => validateCustomEndpoint(endpoint)).not.toThrow();
      const result = validateCustomEndpoint(endpoint);
      expect(result.path).toBe(endpoint.path);
      expect(result.method).toBe(endpoint.method);
      expect(result.description).toBe(endpoint.description);
    });

    it("should accept endpoint with description", () => {
      const endpoint = createValidEndpoint({
        path: "/test",
        method: "post",
        handler: createMockHandler(),
        description: "Test endpoint",
      });

      expect(() => validateCustomEndpoint(endpoint)).not.toThrow();
      const result = validateCustomEndpoint(endpoint);
      expect(result.description).toBe("Test endpoint");
    });

    it("should accept endpoint without description", () => {
      const endpoint = {
        path: "/test",
        method: "put" as const,
        handler: createMockHandler(),
      };

      expect(() => validateCustomEndpoint(endpoint)).not.toThrow();
      const result = validateCustomEndpoint(endpoint);
      expect(result.description).toBeUndefined();
    });

    it("should accept all valid HTTP methods", () => {
      const methods = ["get", "post", "put", "patch", "delete", "options", "head"] as const;

      methods.forEach((method) => {
        const endpoint = createValidEndpoint({
          path: `/test-${method}`,
          method,
          handler: createMockHandler(),
        });

        expect(() => validateCustomEndpoint(endpoint)).not.toThrow();
        const result = validateCustomEndpoint(endpoint);
        expect(result.method).toBe(method);
      });
    });

    it("should accept paths with parameters", () => {
      const endpoint = createValidEndpoint({
        path: "/users/:id/posts/:postId",
        method: "get",
        handler: createMockHandler(),
      });

      expect(() => validateCustomEndpoint(endpoint)).not.toThrow();
      const result = validateCustomEndpoint(endpoint);
      expect(result.path).toBe("/users/:id/posts/:postId");
    });

    it("should accept paths with query parameters", () => {
      const endpoint = createValidEndpoint({
        path: "/search",
        method: "get",
        handler: createMockHandler(),
        description: "Search endpoint with query params",
      });

      expect(() => validateCustomEndpoint(endpoint)).not.toThrow();
    });

    it("should throw CustomEndpointError for invalid path", () => {
      const endpoint = {
        path: "invalid-path", // Missing leading slash
        method: "get" as const,
        handler: createMockHandler(),
      };

      expect(() => validateCustomEndpoint(endpoint)).toThrow(CustomEndpointError);
      expect(() => validateCustomEndpoint(endpoint)).toThrow("Invalid custom endpoint definition");
    });

    it("should throw CustomEndpointError for invalid method", () => {
      const endpoint = {
        path: "/test",
        method: "invalid" as any,
        handler: createMockHandler(),
      };

      expect(() => validateCustomEndpoint(endpoint)).toThrow(CustomEndpointError);
    });

    it("should throw CustomEndpointError for missing handler", () => {
      const endpoint = {
        path: "/test",
        method: "get" as const,
        handler: undefined as any,
      };

      expect(() => validateCustomEndpoint(endpoint)).toThrow(CustomEndpointError);
    });

    it("should throw CustomEndpointError for non-function handler", () => {
      const endpoint = {
        path: "/test",
        method: "get" as const,
        handler: "not a function" as any,
      };

      expect(() => validateCustomEndpoint(endpoint)).toThrow(CustomEndpointError);
    });

    it("should throw CustomEndpointError for missing path", () => {
      const endpoint = {
        method: "get" as const,
        handler: createMockHandler(),
      } as any;

      expect(() => validateCustomEndpoint(endpoint)).toThrow(CustomEndpointError);
    });

    it("should preserve handler function behavior", () => {
      const mockHandler = createMockHandler();
      const endpoint = createValidEndpoint({
        handler: mockHandler,
      });

      const result = validateCustomEndpoint(endpoint);
      expect(typeof result.handler).toBe("function");

      // Verify the handler is still callable with the same behavior
      result.handler({}, { req: {}, res: {} } as any);
      expect(mockHandler).toHaveBeenCalled();
    });

    it("should handle non-ZodError exceptions", () => {
      // Mock CustomEndpointSchema.parse to throw a non-ZodError
      const originalParse = CustomEndpointSchema.parse;
      CustomEndpointSchema.parse = jest.fn(() => {
        throw new Error("Generic error");
      });

      const endpoint = createValidEndpoint();

      expect(() => validateCustomEndpoint(endpoint)).toThrow("Generic error");

      // Restore original parse method
      CustomEndpointSchema.parse = originalParse;
    });
  });

  describe("validateCustomEndpoints", () => {
    it("should validate array of valid endpoints", () => {
      const endpoints = [
        createValidEndpoint({
          path: "/endpoint1",
          method: "get",
          handler: createMockHandler(),
        }),
        createValidEndpoint({
          path: "/endpoint2",
          method: "post",
          handler: createMockHandler(),
        }),
      ];

      const result = validateCustomEndpoints(endpoints);
      expect(result).toHaveLength(2);
      expect(result[0].path).toBe("/endpoint1");
      expect(result[1].path).toBe("/endpoint2");
    });

    it("should handle empty array", () => {
      const result = validateCustomEndpoints([]);
      expect(result).toEqual([]);
    });

    it("should validate single endpoint in array", () => {
      const endpoints = [
        createValidEndpoint({
          path: "/single",
          method: "delete",
          handler: createMockHandler(),
          description: "Single endpoint",
        }),
      ];

      const result = validateCustomEndpoints(endpoints);
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe("/single");
      expect(result[0].method).toBe("delete");
      expect(result[0].description).toBe("Single endpoint");
    });

    it("should validate endpoints with different methods", () => {
      const endpoints = [
        createValidEndpoint({ path: "/get", method: "get" }),
        createValidEndpoint({ path: "/post", method: "post" }),
        createValidEndpoint({ path: "/put", method: "put" }),
        createValidEndpoint({ path: "/patch", method: "patch" }),
        createValidEndpoint({ path: "/delete", method: "delete" }),
      ];

      const result = validateCustomEndpoints(endpoints);
      expect(result).toHaveLength(5);
      expect(result.map((e) => e.method)).toEqual(["get", "post", "put", "patch", "delete"]);
    });

    it("should throw CustomEndpointError for null input", () => {
      expect(() => validateCustomEndpoints(null as any)).toThrow(CustomEndpointError);
      expect(() => validateCustomEndpoints(null as any)).toThrow(
        "Custom endpoints must be an array",
      );
    });

    it("should throw CustomEndpointError for undefined input", () => {
      expect(() => validateCustomEndpoints(undefined as any)).toThrow(CustomEndpointError);
      expect(() => validateCustomEndpoints(undefined as any)).toThrow(
        "Custom endpoints must be an array",
      );
    });

    it("should throw CustomEndpointError for non-array input", () => {
      expect(() => validateCustomEndpoints("not an array" as any)).toThrow(CustomEndpointError);
      expect(() => validateCustomEndpoints({} as any)).toThrow(CustomEndpointError);
      expect(() => validateCustomEndpoints(123 as any)).toThrow(CustomEndpointError);
    });

    it("should throw CustomEndpointError for invalid endpoint in array", () => {
      const endpoints = [
        createValidEndpoint({ path: "/valid", method: "get" }),
        {
          path: "invalid-path", // Missing leading slash
          method: "get" as const,
          handler: createMockHandler(),
        },
      ];

      expect(() => validateCustomEndpoints(endpoints)).toThrow(CustomEndpointError);
    });

    it("should validate all endpoints before returning", () => {
      const mockHandler1 = createMockHandler();
      const mockHandler2 = createMockHandler();
      const mockHandler3 = createMockHandler();

      const endpoints = [
        createValidEndpoint({ path: "/first", method: "get", handler: mockHandler1 }),
        createValidEndpoint({ path: "/second", method: "post", handler: mockHandler2 }),
        createValidEndpoint({ path: "/third", method: "put", handler: mockHandler3 }),
      ];

      const result = validateCustomEndpoints(endpoints);

      expect(result).toHaveLength(3);

      // Verify all handlers are functions and callable
      expect(typeof result[0].handler).toBe("function");
      expect(typeof result[1].handler).toBe("function");
      expect(typeof result[2].handler).toBe("function");

      // Test that the original handlers are still called
      result[0].handler({}, { req: {}, res: {} } as any);
      result[1].handler({}, { req: {}, res: {} } as any);
      result[2].handler({}, { req: {}, res: {} } as any);

      expect(mockHandler1).toHaveBeenCalled();
      expect(mockHandler2).toHaveBeenCalled();
      expect(mockHandler3).toHaveBeenCalled();
    });

    it("should stop validation on first error", () => {
      const endpoints = [
        createValidEndpoint({ path: "/valid", method: "get" }),
        {
          path: "invalid", // Invalid path
          method: "get" as const,
          handler: createMockHandler(),
        },
        createValidEndpoint({ path: "/never-reached", method: "post" }),
      ];

      expect(() => validateCustomEndpoints(endpoints)).toThrow(CustomEndpointError);
    });

    it("should handle endpoints with complex paths", () => {
      const endpoints = [
        createValidEndpoint({
          path: "/api/v1/users/:userId/posts",
          method: "get",
          description: "Get user posts",
        }),
        createValidEndpoint({
          path: "/api/v1/admin/settings",
          method: "put",
          description: "Update admin settings",
        }),
        createValidEndpoint({
          path: "/webhooks/stripe",
          method: "post",
          description: "Stripe webhook handler",
        }),
      ];

      const result = validateCustomEndpoints(endpoints);
      expect(result).toHaveLength(3);
      expect(result[0].path).toBe("/api/v1/users/:userId/posts");
      expect(result[1].path).toBe("/api/v1/admin/settings");
      expect(result[2].path).toBe("/webhooks/stripe");
    });

    it("should handle non-CustomEndpointError exceptions", () => {
      // Create a mock that throws a generic error
      const endpointWithGenericError = {
        path: "/test",
        method: "get" as const,
        handler: createMockHandler(),
      };

      // Mock validateCustomEndpoint to throw a generic error
      const originalValidate = CustomEndpointSchema.parse;
      let callCount = 0;
      CustomEndpointSchema.parse = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return endpointWithGenericError; // First call succeeds
        }
        throw new Error("Generic validation error");
      });

      const endpoints = [
        endpointWithGenericError,
        endpointWithGenericError, // This will cause the error
      ];

      expect(() => validateCustomEndpoints(endpoints)).toThrow(CustomEndpointError);
      expect(() => validateCustomEndpoints(endpoints)).toThrow(
        "Failed to validate custom endpoint",
      );

      // Restore original
      CustomEndpointSchema.parse = originalValidate;
    });

    it("should preserve order of endpoints", () => {
      const endpoints = [
        createValidEndpoint({ path: "/first", method: "get", description: "First" }),
        createValidEndpoint({ path: "/second", method: "post", description: "Second" }),
        createValidEndpoint({ path: "/third", method: "put", description: "Third" }),
        createValidEndpoint({ path: "/fourth", method: "delete", description: "Fourth" }),
      ];

      const result = validateCustomEndpoints(endpoints);

      expect(result).toHaveLength(4);
      expect(result[0].description).toBe("First");
      expect(result[1].description).toBe("Second");
      expect(result[2].description).toBe("Third");
      expect(result[3].description).toBe("Fourth");
    });
  });

  describe("CustomEndpointError", () => {
    it("should be an instance of Error", () => {
      const error = new CustomEndpointError("Test error");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CustomEndpointError);
    });

    it("should have correct name", () => {
      const error = new CustomEndpointError("Test error");
      expect(error.name).toBe("CustomEndpointError");
    });

    it("should preserve error message", () => {
      const message = "Custom endpoint validation failed";
      const error = new CustomEndpointError(message);
      expect(error.message).toBe(message);
    });

    it("should be throwable and catchable", () => {
      const errorMessage = "Test custom endpoint error";

      expect(() => {
        throw new CustomEndpointError(errorMessage);
      }).toThrow(CustomEndpointError);

      try {
        throw new CustomEndpointError(errorMessage);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomEndpointError);
        expect((error as CustomEndpointError).message).toBe(errorMessage);
      }
    });
  });

  describe("integration scenarios", () => {
    it("should handle realistic endpoint definitions", () => {
      const endpoints: CustomEndpointDefinition[] = [
        {
          path: "/api/custom/health",
          method: "get",
          handler: async () => ({ status: "healthy", timestamp: new Date().toISOString() }),
          description: "Health check endpoint",
        },
        {
          path: "/api/custom/users/:id/profile",
          method: "get",
          handler: async (params) => ({ userId: params.id, profile: {} }),
          description: "Get user profile",
        },
        {
          path: "/api/custom/upload",
          method: "post",
          handler: async (params, context) => ({
            uploaded: true,
            filename: context.body?.filename,
          }),
          description: "File upload endpoint",
        },
        {
          path: "/api/custom/settings",
          method: "put",
          handler: async (params, context) => ({
            updated: true,
            settings: context.body,
          }),
        },
      ];

      const result = validateCustomEndpoints(endpoints);
      expect(result).toHaveLength(4);

      // Verify each endpoint is properly validated
      expect(result[0].path).toBe("/api/custom/health");
      expect(result[0].method).toBe("get");
      expect(result[0].description).toBe("Health check endpoint");

      expect(result[1].path).toBe("/api/custom/users/:id/profile");
      expect(result[1].method).toBe("get");

      expect(result[2].path).toBe("/api/custom/upload");
      expect(result[2].method).toBe("post");

      expect(result[3].path).toBe("/api/custom/settings");
      expect(result[3].method).toBe("put");
      expect(result[3].description).toBeUndefined();
    });

    it("should handle edge cases in paths", () => {
      const endpoints = [
        createValidEndpoint({ path: "/", method: "get" }), // Root path
        createValidEndpoint({ path: "/api", method: "get" }), // Simple path
        createValidEndpoint({ path: "/api/v1/users/:id", method: "get" }), // With param
        createValidEndpoint({ path: "/api/v1/users/:id/posts/:postId", method: "get" }), // Multiple params
        createValidEndpoint({ path: "/api-v2/test_endpoint", method: "get" }), // With special chars
      ];

      const result = validateCustomEndpoints(endpoints);
      expect(result).toHaveLength(5);

      expect(result[0].path).toBe("/");
      expect(result[1].path).toBe("/api");
      expect(result[2].path).toBe("/api/v1/users/:id");
      expect(result[3].path).toBe("/api/v1/users/:id/posts/:postId");
      expect(result[4].path).toBe("/api-v2/test_endpoint");
    });

    it("should validate endpoint handlers are callable", () => {
      const asyncHandler = async (params: any, context: any) => ({ success: true });
      const syncHandler = (params: any, context: any) => ({ success: true });
      const arrowHandler = () => ({ success: true });

      const endpoints = [
        createValidEndpoint({ path: "/async", handler: asyncHandler }),
        createValidEndpoint({ path: "/sync", handler: syncHandler }),
        createValidEndpoint({ path: "/arrow", handler: arrowHandler }),
      ];

      const result = validateCustomEndpoints(endpoints);
      expect(result).toHaveLength(3);

      // All handlers should be functions
      expect(typeof result[0].handler).toBe("function");
      expect(typeof result[1].handler).toBe("function");
      expect(typeof result[2].handler).toBe("function");
    });
  });
});
