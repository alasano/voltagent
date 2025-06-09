import { HonoServerAdapter } from "./hono";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { HttpMethod, RouteHandler } from "@voltagent/server-adapter";

// Mock the cors module
jest.mock("hono/cors", () => ({
  cors: jest.fn(() => jest.fn()),
}));

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
  };
}

// Mock Hono context
function createMockHonoContext(overrides: any = {}) {
  return {
    req: {
      param: jest.fn().mockReturnValue({}),
      query: jest.fn().mockReturnValue({}),
      header: jest.fn((key?: string) => {
        if (key) return overrides.headers?.[key] || "";
        return overrides.headers || {};
      }),
      json: jest.fn().mockResolvedValue(overrides.body || {}),
    },
    json: jest.fn().mockResolvedValue({ success: true }),
    html: jest.fn().mockReturnValue("html response"),
    body: jest.fn().mockReturnValue("streamed response"),
    ...overrides,
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
      adapter.addRoute("/test", method, handler);

      expect(mockApp[method]).toHaveBeenCalledWith("/test", expect.any(Function));
    });

    it("should pass params to handler", async () => {
      const handler: RouteHandler = jest.fn().mockResolvedValue({ result: "success" });
      const params = { id: "123" };

      adapter.addRoute("/test/:id", "get", handler);

      const registeredHandler = mockApp.get.mock.calls[0][1];
      const mockContext = createMockHonoContext();
      mockContext.req.param.mockReturnValue(params);

      await registeredHandler(mockContext);

      expect(handler).toHaveBeenCalledWith(params, expect.any(Object));
    });

    it("should pass query params to handler", async () => {
      const handler: RouteHandler = jest.fn().mockResolvedValue({ result: "success" });
      const query = { filter: "active" };

      adapter.addRoute("/test", "get", handler);

      const registeredHandler = mockApp.get.mock.calls[0][1];
      const mockContext = createMockHonoContext();
      mockContext.req.query.mockReturnValue(query);

      await registeredHandler(mockContext);

      expect(handler).toHaveBeenCalledWith({}, expect.objectContaining({ query }));
    });

    it("should pass body to handler for POST requests", async () => {
      const handler: RouteHandler = jest.fn().mockResolvedValue({ result: "success" });
      const body = { name: "test" };

      adapter.addRoute("/test", "post", handler);

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

      adapter.addRoute("/test", "get", handler);

      const registeredHandler = mockApp.get.mock.calls[0][1];
      const mockContext = createMockHonoContext();

      await registeredHandler(mockContext);

      expect(mockContext.html).toHaveBeenCalledWith("<html>Test</html>");
    });

    it("should handle handler errors", async () => {
      // Suppress expected error logging for this test
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const handler: RouteHandler = jest.fn().mockRejectedValue(new Error("Test error"));

      adapter.addRoute("/test", "get", handler);

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

      adapter.addRoute("/test", "post", handler);

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
      adapter.addStreamingRoute("/stream", "post", handler);

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

      adapter.addStreamingRoute("/stream", "post", handler);

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

      adapter.addStreamingRoute("/stream", "post", handler);

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

      adapter.addStreamingRoute("/stream", "post", handler);

      const registeredHandler = mockApp.post.mock.calls[0][1];
      const mockContext = createMockHonoContext();

      await registeredHandler(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: "Stream error",
        },
        500,
      );

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error in streaming route POST /stream:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("edge cases", () => {
    it("should handle missing headers gracefully", async () => {
      const handler: RouteHandler = jest.fn().mockResolvedValue({ success: true });

      adapter.addRoute("/api/agents/:id/process", "post", handler);

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

      adapter.addRoute("/test", "get", handler);

      const registeredHandler = mockApp.get.mock.calls[0][1];
      const mockContext = createMockHonoContext();

      await registeredHandler(mockContext);

      expect(mockContext.req.json).not.toHaveBeenCalled();
    });
  });
});
