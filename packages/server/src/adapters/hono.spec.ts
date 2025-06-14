// Mock @hono/zod-openapi before importing
jest.mock("@hono/zod-openapi", () => {
  const mockZodSchema: any = {
    parse: jest.fn(),
    safeParse: jest.fn(),
    optional: jest.fn(() => mockZodSchema),
    nullable: jest.fn(() => mockZodSchema),
    uuid: jest.fn(() => mockZodSchema),
    min: jest.fn(() => mockZodSchema),
    max: jest.fn(() => mockZodSchema),
    default: jest.fn(() => mockZodSchema),
    datetime: jest.fn(() => mockZodSchema),
    describe: jest.fn(() => mockZodSchema),
    passthrough: jest.fn(() => mockZodSchema),
    merge: jest.fn(() => mockZodSchema),
    strict: jest.fn(() => mockZodSchema),
    extend: jest.fn(() => mockZodSchema),
    or: jest.fn(() => mockZodSchema),
    strip: jest.fn(() => mockZodSchema),
    refine: jest.fn(() => mockZodSchema),
    openapi: jest.fn(() => mockZodSchema),
    _type: "ZodObject",
    _output: {},
    _input: {},
    _def: {},
  };

  const mockZodString: any = {
    ...mockZodSchema,
    uuid: jest.fn(() => mockZodSchema),
    datetime: jest.fn(() => mockZodSchema),
    describe: jest.fn(() => mockZodSchema),
    base64: jest.fn(() => mockZodSchema),
    startsWith: jest.fn(() => mockZodSchema),
    url: jest.fn(() => mockZodSchema),
    openapi: jest.fn(() => mockZodSchema),
  };

  const mockZodNumber: any = {
    ...mockZodSchema,
    min: jest.fn(() => mockZodSchema),
    max: jest.fn(() => mockZodSchema),
    describe: jest.fn(() => mockZodSchema),
    int: jest.fn(() => mockZodNumber),
    positive: jest.fn(() => mockZodSchema),
    openapi: jest.fn(() => mockZodSchema),
  };

  const mockZodFunction: any = {
    ...mockZodSchema,
    args: jest.fn(() => mockZodFunction),
    returns: jest.fn(() => mockZodSchema),
  };

  return {
    OpenAPIHono: jest.fn(),
    createRoute: jest.fn((config) => config),
    z: {
      object: jest.fn(() => mockZodSchema),
      string: jest.fn(() => mockZodString),
      number: jest.fn(() => mockZodNumber),
      function: jest.fn(() => mockZodFunction),
      any: jest.fn(() => mockZodSchema),
      enum: jest.fn(() => mockZodSchema),
      nativeEnum: jest.fn(() => mockZodSchema),
      union: jest.fn(() => mockZodSchema),
      discriminatedUnion: jest.fn(() => mockZodSchema),
      optional: jest.fn(() => mockZodSchema),
      literal: jest.fn(() => mockZodSchema),
      boolean: jest.fn(() => mockZodSchema),
      array: jest.fn(() => mockZodSchema),
      record: jest.fn(() => mockZodSchema),
      tuple: jest.fn(() => mockZodSchema),
      void: jest.fn(() => mockZodSchema),
      null: jest.fn(() => mockZodSchema),
      undefined: jest.fn(() => mockZodSchema),
      unknown: jest.fn(() => mockZodSchema),
      never: jest.fn(() => mockZodSchema),
    },
  };
});

import { HonoServerAdapter } from "./hono";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { HttpMethod, RouteHandler } from "@voltagent/server-adapter";

// Mock the cors module
jest.mock("hono/cors", () => ({
  cors: jest.fn(() => jest.fn()),
}));

// Mock zod for schema validation
jest.mock("zod", () => {
  const mockZodSchema: any = {
    parse: jest.fn(),
    safeParse: jest.fn(),
    optional: jest.fn(() => mockZodSchema),
    nullable: jest.fn(() => mockZodSchema),
    uuid: jest.fn(() => mockZodSchema),
    min: jest.fn(() => mockZodSchema),
    max: jest.fn(() => mockZodSchema),
    default: jest.fn(() => mockZodSchema),
    datetime: jest.fn(() => mockZodSchema),
    describe: jest.fn(() => mockZodSchema),
    passthrough: jest.fn(() => mockZodSchema),
    merge: jest.fn(() => mockZodSchema),
    strict: jest.fn(() => mockZodSchema),
    extend: jest.fn(() => mockZodSchema),
    or: jest.fn(() => mockZodSchema),
    strip: jest.fn(() => mockZodSchema),
    refine: jest.fn(() => mockZodSchema),
    _type: "ZodObject",
    _output: {},
    _input: {},
    _def: {},
  };

  const mockZodString: any = {
    ...mockZodSchema,
    uuid: jest.fn(() => mockZodSchema),
    datetime: jest.fn(() => mockZodSchema),
    describe: jest.fn(() => mockZodSchema),
    base64: jest.fn(() => mockZodSchema),
    startsWith: jest.fn(() => mockZodSchema),
    url: jest.fn(() => mockZodSchema),
  };

  const mockZodNumber: any = {
    ...mockZodSchema,
    min: jest.fn(() => mockZodSchema),
    max: jest.fn(() => mockZodSchema),
    describe: jest.fn(() => mockZodSchema),
    int: jest.fn(() => mockZodSchema),
  };

  const mockZodFunction: any = {
    ...mockZodSchema,
    args: jest.fn(() => mockZodFunction),
    returns: jest.fn(() => mockZodSchema),
  };

  return {
    z: {
      object: jest.fn(() => mockZodSchema),
      string: jest.fn(() => mockZodString),
      number: jest.fn(() => mockZodNumber),
      function: jest.fn(() => mockZodFunction),
      any: jest.fn(() => mockZodSchema),
      enum: jest.fn(() => mockZodSchema),
      nativeEnum: jest.fn(() => mockZodSchema),
      union: jest.fn(() => mockZodSchema),
      discriminatedUnion: jest.fn(() => mockZodSchema),
      optional: jest.fn(() => mockZodSchema),
      literal: jest.fn(() => mockZodSchema),
      boolean: jest.fn(() => mockZodSchema),
      array: jest.fn(() => mockZodSchema),
      record: jest.fn(() => mockZodSchema),
      tuple: jest.fn(() => mockZodSchema),
      void: jest.fn(() => mockZodSchema),
      null: jest.fn(() => mockZodSchema),
      undefined: jest.fn(() => mockZodSchema),
      unknown: jest.fn(() => mockZodSchema),
      never: jest.fn(() => mockZodSchema),
    },
  };
});

// Access the mock after it's defined
const mockZodSchema = (() => {
  const { z } = require("zod");
  return z.object();
})();

// Mock Hono app interface for testing
interface MockHonoApp {
  get: jest.MockedFunction<(path: string, handler: any) => any>;
  post: jest.MockedFunction<(path: string, handler: any) => any>;
  put: jest.MockedFunction<(path: string, handler: any) => any>;
  delete: jest.MockedFunction<(path: string, handler: any) => any>;
  patch: jest.MockedFunction<(path: string, handler: any) => any>;
  options: jest.MockedFunction<(path: string, handler: any) => any>;
  head: jest.MockedFunction<(path: string, handler: any) => any>;
  use: jest.MockedFunction<(path: string, handler: any) => any>;
  openapi: jest.MockedFunction<(route: any, handler: any) => any>;
  all: jest.MockedFunction<(path: string, handler: any) => any>;
}

// Mock Hono app - create a proper mock that satisfies our test needs
function createMockHonoApp(): MockHonoApp {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    options: jest.fn(),
    head: jest.fn(),
    use: jest.fn(),
    openapi: jest.fn(),
    all: jest.fn(),
  };
}

// Mock Hono context
function createMockHonoContext(overrides: any = {}) {
  const defaultReq = {
    param: jest.fn().mockReturnValue({}),
    query: jest.fn().mockReturnValue({}),
    header: jest.fn((key?: string) => {
      if (key) return overrides.headers?.[key] || "";
      return overrides.headers || {};
    }),
    json: jest.fn().mockResolvedValue(overrides.body || {}),
  };

  const context = {
    req: {
      ...defaultReq,
      ...overrides.req,
    },
    json: jest.fn().mockResolvedValue({ success: true }),
    html: jest.fn().mockReturnValue("html response"),
    body: jest.fn().mockReturnValue("streamed response"),
  };

  // Only override non-req properties from overrides to avoid losing req functions
  const { req: _reqOverrides, ...otherOverrides } = overrides;
  return {
    ...context,
    ...otherOverrides,
  };
}

describe("HonoServerAdapter", () => {
  let mockApp: MockHonoApp;
  let adapter: HonoServerAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApp = createMockHonoApp();
    adapter = new HonoServerAdapter(mockApp as any);
  });

  describe("constructor", () => {
    it("should configure CORS on initialization", () => {
      expect(mockApp.use).toHaveBeenCalledWith("/*", expect.any(Function));
    });
  });

  describe("addRoute", () => {
    const methods: HttpMethod[] = ["get", "post", "put", "delete", "patch", "options", "head"];

    it.each(methods)("should add %s route", (method) => {
      const handler: RouteHandler = jest.fn();
      adapter.addRoute({ path: "/test", method, handler });

      expect(mockApp[method]).toHaveBeenCalledWith("/test", expect.any(Function));
    });

    it("should pass params to handler", async () => {
      const handler: RouteHandler = jest.fn().mockResolvedValue({ result: "success" });
      const params = { id: "123" };

      adapter.addRoute({ path: "/test/:id", method: "get", handler: handler });

      const registeredHandler = mockApp.get.mock.calls[0][1];
      const mockContext = createMockHonoContext();
      mockContext.req.param.mockReturnValue(params);

      await registeredHandler(mockContext);

      expect(handler).toHaveBeenCalledWith(params, expect.any(Object));
    });

    it("should pass query params to handler", async () => {
      const handler: RouteHandler = jest.fn().mockResolvedValue({ result: "success" });
      const query = { filter: "active" };

      adapter.addRoute({ path: "/test", method: "get", handler: handler });

      const registeredHandler = mockApp.get.mock.calls[0][1];
      const mockContext = createMockHonoContext();
      mockContext.req.query.mockReturnValue(query);

      await registeredHandler(mockContext);

      expect(handler).toHaveBeenCalledWith({}, expect.objectContaining({ query }));
    });

    it("should pass body to handler for POST requests", async () => {
      const handler: RouteHandler = jest.fn().mockResolvedValue({ result: "success" });
      const body = { name: "test" };

      adapter.addRoute({ path: "/test", method: "post", handler: handler });

      const registeredHandler = mockApp.post.mock.calls[0][1];
      const mockContext = createMockHonoContext({ body });

      await registeredHandler(mockContext);

      expect(handler).toHaveBeenCalledWith({}, expect.objectContaining({ body }));
    });

    it("should handle HTML content type", async () => {
      const handler: RouteHandler = jest.fn().mockResolvedValue({
        contentType: "text/html",
        content: "<html>Test</html>",
      });

      adapter.addRoute({ path: "/test", method: "get", handler: handler });

      const registeredHandler = mockApp.get.mock.calls[0][1];
      const mockContext = createMockHonoContext();

      await registeredHandler(mockContext);

      expect(mockContext.html).toHaveBeenCalledWith("<html>Test</html>");
    });

    it("should handle handler errors", async () => {
      // Suppress expected error logging for this test
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const handler: RouteHandler = jest.fn().mockRejectedValue(new Error("Test error"));

      adapter.addRoute({ path: "/test", method: "get", handler: handler });

      const registeredHandler = mockApp.get.mock.calls[0][1];
      const mockContext = createMockHonoContext();

      await registeredHandler(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: "Test error",
        },
        500,
      );

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error in route GET /test:", expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it("should handle body parsing errors gracefully", async () => {
      const handler: RouteHandler = jest.fn().mockResolvedValue({ success: true });

      adapter.addRoute({ path: "/test", method: "post", handler: handler });

      const registeredHandler = mockApp.post.mock.calls[0][1];
      const mockContext = createMockHonoContext();
      mockContext.req.json.mockRejectedValue(new Error("Invalid JSON"));

      await registeredHandler(mockContext);

      expect(handler).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          body: undefined,
        }),
      );
    });
  });

  describe("addStreamingRoute", () => {
    it("should add streaming route", () => {
      const handler = jest.fn();
      adapter.addStreamingRoute({ path: "/stream", method: "post", handler: handler });

      expect(mockApp.post).toHaveBeenCalledWith("/stream", expect.any(Function));
    });

    it("should handle text streaming", async () => {
      const textStream = {
        [Symbol.asyncIterator]: async function* () {
          yield "chunk1";
          yield "chunk2";
        },
      };
      const handler = jest.fn().mockResolvedValue({ textStream });

      adapter.addStreamingRoute({ path: "/stream", method: "post", handler: handler });

      const registeredHandler = mockApp.post.mock.calls[0][1];
      const mockContext = createMockHonoContext();

      await registeredHandler(mockContext);

      expect(mockContext.body).toHaveBeenCalledWith(
        expect.any(ReadableStream),
        expect.objectContaining({
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }),
      );
    });

    it("should handle object streaming", async () => {
      const objectStream = new ReadableStream({
        start(controller) {
          controller.enqueue({ id: 1, name: "test" });
          controller.close();
        },
      });
      const handler = jest.fn().mockResolvedValue({ objectStream });

      adapter.addStreamingRoute({ path: "/stream", method: "post", handler: handler });

      const registeredHandler = mockApp.post.mock.calls[0][1];
      const mockContext = createMockHonoContext();

      await registeredHandler(mockContext);

      expect(mockContext.body).toHaveBeenCalledWith(
        expect.any(ReadableStream),
        expect.objectContaining({
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }),
      );
    });

    it("should handle streaming errors", async () => {
      // Suppress expected error logging for this test
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const handler = jest.fn().mockRejectedValue(new Error("Stream error"));

      adapter.addStreamingRoute({ path: "/stream", method: "post", handler: handler });

      const registeredHandler = mockApp.post.mock.calls[0][1];
      const mockContext = createMockHonoContext();

      await registeredHandler(mockContext);

      // With fullStream, errors inside the stream are handled as SSE events
      expect(mockContext.body).toHaveBeenCalledWith(
        expect.any(ReadableStream),
        expect.objectContaining({
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }),
      );

      // Verify error was logged as stream setup error since handler is called during setup
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error during stream setup:", expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  describe("edge cases", () => {
    it("should handle missing headers gracefully", async () => {
      const handler: RouteHandler = jest.fn().mockResolvedValue({ success: true });

      adapter.addRoute({ path: "/api/agents/:id/process", method: "post", handler: handler });

      const registeredHandler = mockApp.post.mock.calls[0][1];
      const mockContext = createMockHonoContext({
        headers: null,
      });
      mockContext.req.header = jest.fn().mockReturnValue(null);

      await registeredHandler(mockContext);

      expect(handler).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          headers: {},
        }),
      );
    });

    it("should not parse body for GET requests", async () => {
      const handler: RouteHandler = jest.fn().mockResolvedValue({ success: true });

      adapter.addRoute({ path: "/test", method: "get", handler: handler });

      const registeredHandler = mockApp.get.mock.calls[0][1];
      const mockContext = createMockHonoContext();

      await registeredHandler(mockContext);

      expect(mockContext.req.json).not.toHaveBeenCalled();
    });
  });

  describe("OpenAPI route handling", () => {
    let mockApp: any;

    beforeEach(() => {
      jest.clearAllMocks();
      mockApp = {
        ...createMockHonoApp(),
        openapi: jest.fn(),
        notFound: jest.fn(),
        onError: jest.fn(),
      };
      adapter = new HonoServerAdapter(mockApp as any);
    });

    it("should handle OpenAPI route registration", () => {
      const openApiRoute = {
        path: "/api/test",
        method: "post" as const,
        operationId: "testOperation",
        openapi: {
          request: {
            body: {
              content: {
                "application/json": {
                  schema: mockZodSchema,
                },
              },
            },
          },
          responses: {
            200: {
              description: "Success",
              content: {
                "application/json": {
                  schema: mockZodSchema,
                },
              },
            },
          },
        },
        handler: jest.fn(),
      };

      adapter.addRoute(openApiRoute as any);

      expect(mockApp.openapi).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/api/test",
          method: "post",
        }),
        expect.any(Function),
      );
    });

    it("should handle OpenAPI route with tags and description", () => {
      const openApiRoute = {
        path: "/api/test",
        method: "get" as const,
        operationId: "getTest",
        openapi: {
          tags: ["Test"],
          description: "Test endpoint",
          summary: "Get test data",
          request: {},
          responses: {
            200: {
              description: "Success",
            },
          },
        },
        handler: jest.fn(),
      };

      adapter.addRoute(openApiRoute as any);

      expect(mockApp.openapi).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ["Test"],
          description: "Test endpoint",
          summary: "Get test data",
        }),
        expect.any(Function),
      );
    });

    it("should use validated data for OpenAPI routes", async () => {
      const handler: RouteHandler = jest.fn().mockResolvedValue({ success: true });

      const openApiRoute = {
        path: "/api/test",
        method: "post" as const,
        openapi: {
          request: {
            params: { schema: { type: "object" } },
            query: { schema: { type: "object" } },
            body: { schema: { type: "object" } },
          },
          responses: { 200: { description: "Success" } },
        },
        handler,
      };

      adapter.addRoute(openApiRoute as any);

      const registeredHandler = mockApp.openapi.mock.calls[0][1];
      const mockContext = createMockHonoContext();
      mockContext.req.valid = jest
        .fn()
        .mockReturnValueOnce({ id: "123" }) // params
        .mockReturnValueOnce({ filter: "active" }) // query
        .mockReturnValueOnce({ name: "test" }); // body

      await registeredHandler(mockContext);

      expect(handler).toHaveBeenCalledWith(
        { id: "123" },
        expect.objectContaining({
          params: { id: "123" },
          query: { filter: "active" },
          body: { name: "test" },
        }),
      );
    });

    it("should handle OpenAPI route errors", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      const handler: RouteHandler = jest.fn().mockRejectedValue(new Error("OpenAPI error"));

      const openApiRoute = {
        path: "/api/test",
        method: "get" as const,
        openapi: {
          request: {},
          responses: { 200: { description: "Success" } },
        },
        handler,
      };

      adapter.addRoute(openApiRoute as any);

      const registeredHandler = mockApp.openapi.mock.calls[0][1];
      const mockContext = createMockHonoContext();

      await registeredHandler(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: "OpenAPI error",
        },
        500,
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error in OpenAPI route GET /api/test:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("error handling edge cases", () => {
    it("should handle missing body parser error", async () => {
      const mockCtx = createMockHonoContext({
        req: {
          json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
        },
      });

      const route = {
        path: "/test",
        method: "post" as const,
        handler: jest.fn().mockResolvedValue({ success: true }),
      };

      adapter.addRoute(route);
      const registeredHandler = mockApp.post.mock.calls[0][1];

      await registeredHandler(mockCtx);

      expect(route.handler).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          body: undefined,
        }),
      );
    });

    it("should handle header extraction failure gracefully", async () => {
      const mockCtx = createMockHonoContext({
        req: {
          header: jest.fn().mockImplementation(() => {
            throw new Error("Header error");
          }),
        },
      });

      const route = {
        path: "/test",
        method: "get" as const,
        handler: jest.fn().mockResolvedValue({
          status: 200,
          body: { success: true },
        }),
      };

      adapter.addRoute(route);
      const registeredHandler = mockApp.get.mock.calls[0][1];

      await registeredHandler(mockCtx);

      // Should still work despite header error
      expect(route.handler).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          headers: {}, // Empty headers due to error
        }),
      );
    });
  });

  describe("streaming route error handling", () => {
    it("should handle stream creation errors", async () => {
      // Suppress expected error logging for this test
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const mockCtx = createMockHonoContext();

      const streamingRoute = {
        path: "/stream",
        method: "get" as const,
        handler: jest.fn().mockImplementation(() => {
          throw new Error("Stream creation failed");
        }),
      };

      adapter.addStreamingRoute!(streamingRoute);
      const registeredHandler = mockApp.get.mock.calls[0][1];

      await registeredHandler(mockCtx);

      // With fullStream, even sync errors inside the stream handler are handled as SSE events
      expect(mockCtx.body).toHaveBeenCalledWith(
        expect.any(ReadableStream),
        expect.objectContaining({
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }),
      );

      // Verify error was logged as stream setup error
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error during stream setup:", expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it("should handle stream errors during data flow", async () => {
      const mockCtx = createMockHonoContext();

      let streamController: any;
      const problemStream = new ReadableStream({
        start(controller) {
          streamController = controller;
          controller.enqueue("data1");
        },
      });

      const streamingRoute = {
        path: "/stream",
        method: "get" as const,
        handler: jest.fn().mockResolvedValue({
          status: 200,
          objectStream: problemStream,
        }),
      };

      adapter.addStreamingRoute!(streamingRoute);
      const registeredHandler = mockApp.get.mock.calls[0][1];

      const response = await registeredHandler(mockCtx);

      // Force an error after stream starts
      setTimeout(() => {
        streamController.error(new Error("Stream error"));
      }, 0);

      expect(mockCtx.body).toHaveBeenCalledWith(
        expect.any(ReadableStream),
        expect.objectContaining({
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }),
      );
    });

    it("should handle OpenAPI streaming routes", () => {
      const streamingRoute = {
        path: "/stream",
        method: "post" as const,
        openapi: {
          request: {
            body: {
              content: {
                "application/json": {
                  schema: mockZodSchema,
                },
              },
            },
          },
          responses: {
            200: {
              description: "Stream response",
            },
          },
        },
        handler: jest.fn().mockResolvedValue({
          textStream: (async function* () {
            yield "chunk1";
            yield "chunk2";
          })(),
        }),
      };

      adapter.addStreamingRoute!(streamingRoute as any);

      expect(mockApp.openapi).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/stream",
          method: "post",
        }),
        expect.any(Function),
      );
    });
  });

  describe("response type handling", () => {
    it("should handle responses with custom headers", async () => {
      const route = {
        path: "/test",
        method: "get" as const,
        handler: jest.fn().mockResolvedValue({
          status: 200,
          headers: {
            "X-Custom-Header": "custom-value",
            "Cache-Control": "no-cache",
          },
          body: { data: "test" },
        }),
      };

      adapter.addRoute(route);
      const registeredHandler = mockApp.get.mock.calls[0][1];

      const mockCtx = createMockHonoContext();
      await registeredHandler(mockCtx);

      expect(mockCtx.json).toHaveBeenCalledWith({
        status: 200,
        headers: {
          "X-Custom-Header": "custom-value",
          "Cache-Control": "no-cache",
        },
        body: { data: "test" },
      });
    });

    it("should handle empty responses", async () => {
      const route = {
        path: "/test",
        method: "delete" as const,
        handler: jest.fn().mockResolvedValue({
          status: 204,
        }),
      };

      adapter.addRoute(route);
      const registeredHandler = mockApp.delete.mock.calls[0][1];

      const mockCtx = createMockHonoContext();
      await registeredHandler(mockCtx);

      expect(mockCtx.json).toHaveBeenCalledWith({
        status: 204,
      });
    });
  });

  describe("getRegisteredRoutes", () => {
    it("should track all registered routes", () => {
      adapter.addRoute({
        path: "/route1",
        method: "get",
        handler: jest.fn(),
      });

      adapter.addRoute({
        path: "/route2",
        method: "post",
        handler: jest.fn(),
      });

      adapter.addStreamingRoute!({
        path: "/stream",
        method: "get",
        handler: jest.fn(),
      });

      const routes = adapter.getRegisteredRoutes();

      expect(routes).toHaveLength(3);
      expect(routes).toContainEqual(expect.objectContaining({ path: "/route1", method: "get" }));
      expect(routes).toContainEqual(expect.objectContaining({ path: "/route2", method: "post" }));
      expect(routes).toContainEqual(expect.objectContaining({ path: "/stream", method: "get" }));
    });
  });
});
