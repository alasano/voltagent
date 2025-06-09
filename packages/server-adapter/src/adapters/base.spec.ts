import { ServerAdapter } from "./base";
import type { HttpMethod, RouteHandler, RouteDefinition } from "../types";

// Concrete implementation of ServerAdapter for testing
class TestServerAdapter extends ServerAdapter {
  public routes: Array<{
    path: string;
    method: HttpMethod;
    handler: RouteHandler;
  }> = [];

  addRoute(route: RouteDefinition): void {
    this.routes.push({
      path: route.path,
      method: route.method,
      handler: route.handler,
    });
    // Update base class registeredRoutes as well
    this.registeredRoutes.push(route);
  }

  // Test helper methods
  findRoute(path: string, method: HttpMethod) {
    return this.routes.find((route) => route.path === path && route.method === method);
  }

  // Access protected property for testing
  getProtectedRegisteredRoutes() {
    return this.registeredRoutes;
  }
}

describe("ServerAdapter", () => {
  let adapter: TestServerAdapter;

  beforeEach(() => {
    adapter = new TestServerAdapter();
  });

  describe("constructor", () => {
    it("should create an instance of ServerAdapter", () => {
      expect(adapter).toBeInstanceOf(ServerAdapter);
      expect(adapter).toBeInstanceOf(TestServerAdapter);
    });
  });

  describe("addRoute", () => {
    it("should register a GET route", () => {
      const handler: RouteHandler = jest.fn().mockResolvedValue({ success: true });

      adapter.addRoute({ path: "/test-get", method: "get", handler });

      const registeredRoute = adapter.findRoute("/test-get", "get");
      expect(registeredRoute).toBeDefined();
      expect(registeredRoute?.path).toBe("/test-get");
      expect(registeredRoute?.method).toBe("get");
      expect(registeredRoute?.handler).toBe(handler);
    });

    it("should register a POST route", () => {
      const handler: RouteHandler = jest.fn().mockResolvedValue({ success: true });

      adapter.addRoute({ path: "/test-post", method: "post", handler: handler });

      const registeredRoute = adapter.findRoute("/test-post", "post");
      expect(registeredRoute).toBeDefined();
      expect(registeredRoute?.method).toBe("post");
    });

    it("should register routes with different HTTP methods", () => {
      const methods: HttpMethod[] = ["get", "post", "put", "delete", "patch", "options", "head"];

      methods.forEach((method) => {
        const handler: RouteHandler = jest.fn().mockResolvedValue({ success: true });
        adapter.addRoute({ path: `/test-${method}`, method, handler });
      });

      expect(adapter.getRegisteredRoutes()).toHaveLength(methods.length);

      methods.forEach((method) => {
        const route = adapter.findRoute(`/test-${method}`, method);
        expect(route).toBeDefined();
        expect(route?.method).toBe(method);
      });
    });

    it("should handle multiple routes on the same path with different methods", () => {
      const getHandler: RouteHandler = jest.fn().mockResolvedValue({ method: "GET" });
      const postHandler: RouteHandler = jest.fn().mockResolvedValue({ method: "POST" });

      adapter.addRoute({ path: "/same-path", method: "get", handler: getHandler });
      adapter.addRoute({ path: "/same-path", method: "post", handler: postHandler });

      const getRoute = adapter.findRoute("/same-path", "get");
      const postRoute = adapter.findRoute("/same-path", "post");

      expect(getRoute?.handler).toBe(getHandler);
      expect(postRoute?.handler).toBe(postHandler);
    });
  });

  describe("routes with different access patterns", () => {
    it("should register public routes", () => {
      const handler: RouteHandler = jest.fn().mockResolvedValue({ success: true });

      adapter.addRoute({ path: "/public-test", method: "get", handler: handler });

      const registeredRoute = adapter.findRoute("/public-test", "get");
      expect(registeredRoute).toBeDefined();
    });

    it("should register protected routes using the same method", () => {
      // In the new architecture, all routes use addRoute
      // Protection/authentication is handled at a different layer
      const methods: HttpMethod[] = ["get", "post", "put", "delete"];

      methods.forEach((method) => {
        const handler: RouteHandler = jest.fn().mockResolvedValue({ success: true });
        adapter.addRoute({ path: `/protected-${method}`, method, handler });
      });

      methods.forEach((method) => {
        const route = adapter.findRoute(`/protected-${method}`, method);
        expect(route).toBeDefined();
      });
    });
  });

  describe("abstract method enforcement", () => {
    it("should require implementation of abstract methods", () => {
      // This test verifies that ServerAdapter is an abstract class
      // In TypeScript, this is enforced at compile time, not runtime
      // We can verify that ServerAdapter cannot be called as constructor
      expect(ServerAdapter.prototype.constructor).toBe(ServerAdapter);
      expect(typeof ServerAdapter.prototype.addRoute).toBe("undefined");
    });
  });

  describe("route management", () => {
    it("should maintain collection of routes", () => {
      const handler1: RouteHandler = jest.fn();
      const handler2: RouteHandler = jest.fn();

      adapter.addRoute({ path: "/route1", method: "get", handler: handler1 });
      adapter.addRoute({ path: "/route2", method: "post", handler: handler2 });

      const routes = adapter.getRegisteredRoutes();
      expect(routes).toHaveLength(2);

      const route1 = routes.find((r) => r.path === "/route1");
      const route2 = routes.find((r) => r.path === "/route2");

      expect(route1?.method).toBe("get");
      expect(route2?.method).toBe("post");
    });

    it("should handle empty route collections", () => {
      const routes = adapter.getRegisteredRoutes();
      expect(routes).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("should handle invalid route paths", () => {
      const handler: RouteHandler = jest.fn();

      // Most validation should be done by the concrete implementation
      // Base class should accept whatever the implementation allows
      expect(() => {
        adapter.addRoute({ path: "", method: "get", handler });
      }).not.toThrow();
    });

    it("should handle null/undefined handlers gracefully", () => {
      // Base class should accept null handlers - validation in implementation
      expect(() => {
        adapter.addRoute({ path: "/test", method: "get", handler: null as any });
      }).not.toThrow();
    });
  });

  describe("optional methods", () => {
    it("should have optional addStreamingRoute method", () => {
      // addStreamingRoute is optional and not implemented in TestServerAdapter
      expect(adapter.addStreamingRoute).toBeUndefined();
    });

    it("should have optional addWebSocketHandler method", () => {
      // addWebSocketHandler is optional and not implemented in TestServerAdapter
      expect(adapter.addWebSocketHandler).toBeUndefined();
    });
  });

  // Additional coverage for base adapter methods
  describe("ServerAdapter - Additional Coverage", () => {
    describe("getRegisteredRoutes", () => {
      it("should return routes array", () => {
        const routes = adapter.getRegisteredRoutes();
        expect(Array.isArray(routes)).toBe(true);
      });

      it("should return routes added via addRoute", () => {
        const handler: RouteHandler = jest.fn();
        adapter.addRoute({ path: "/test", method: "get", handler });

        const routes = adapter.getRegisteredRoutes();
        expect(routes).toContainEqual(
          expect.objectContaining({
            path: "/test",
            method: "get",
            handler,
          }),
        );
      });

      it("should accumulate multiple routes", () => {
        const handler1: RouteHandler = jest.fn();
        const handler2: RouteHandler = jest.fn();

        adapter.addRoute({ path: "/test1", method: "get", handler: handler1 });
        adapter.addRoute({ path: "/test2", method: "post", handler: handler2 });

        const routes = adapter.getRegisteredRoutes();
        expect(routes).toHaveLength(2);
      });
    });

    describe("addSimpleRoute", () => {
      it("should delegate to addRoute with correct format", () => {
        const handler = jest.fn();
        const spy = jest.spyOn(adapter, "addRoute");

        adapter.addSimpleRoute("/simple", "get", handler);

        expect(spy).toHaveBeenCalledWith({
          path: "/simple",
          method: "get",
          handler,
        });
      });

      it("should work with all HTTP methods", () => {
        const methods: HttpMethod[] = ["get", "post", "put", "patch", "delete", "options", "head"];
        const spy = jest.spyOn(adapter, "addRoute");

        methods.forEach((method) => {
          const handler = jest.fn();
          adapter.addSimpleRoute(`/test-${method}`, method, handler);

          expect(spy).toHaveBeenCalledWith({
            path: `/test-${method}`,
            method,
            handler,
          });
        });
      });
    });

    describe("addSimpleStreamingRoute", () => {
      it("should delegate to addStreamingRoute when available", () => {
        // Create a test adapter that implements streaming
        class StreamingTestAdapter extends TestServerAdapter {
          addStreamingRoute = jest.fn();
        }

        const streamingAdapter = new StreamingTestAdapter();
        const handler = jest.fn();

        streamingAdapter.addSimpleStreamingRoute?.("/stream", "post", handler);

        expect(streamingAdapter.addStreamingRoute).toHaveBeenCalledWith({
          path: "/stream",
          method: "post",
          handler,
        });
      });

      it("should not throw when addStreamingRoute is not implemented", () => {
        const handler = jest.fn();

        expect(() => {
          adapter.addSimpleStreamingRoute?.("/stream", "post", handler);
        }).not.toThrow();
      });
    });

    describe("base implementation methods", () => {
      it("should provide getRegisteredRoutes implementation", () => {
        // Base adapter should have getRegisteredRoutes method
        const routes = adapter.getRegisteredRoutes();
        expect(routes).toBeDefined();
        expect(Array.isArray(routes)).toBe(true);
      });

      it("should maintain registeredRoutes state", () => {
        const initialLength = adapter.getRegisteredRoutes().length;
        const handler = jest.fn();

        adapter.addRoute({ path: "/state-test", method: "get", handler });

        expect(adapter.getRegisteredRoutes()).toHaveLength(initialLength + 1);
      });
    });
  });

  describe("integration scenarios", () => {
    it("should handle complex routing scenarios", () => {
      // Simulate a real application's routing setup
      const routes = [
        { path: "/api/agents", method: "get" as HttpMethod, public: true },
        { path: "/api/agents/:id", method: "get" as HttpMethod, public: true },
        { path: "/api/agents", method: "post" as HttpMethod, public: false },
        { path: "/api/agents/:id", method: "put" as HttpMethod, public: false },
        { path: "/api/agents/:id", method: "delete" as HttpMethod, public: false },
      ];

      routes.forEach(({ path, method }) => {
        const handler = jest.fn().mockResolvedValue({ success: true });
        adapter.addRoute({ path, method, handler });
      });

      const registeredRoutes = adapter.getRegisteredRoutes();
      expect(registeredRoutes).toHaveLength(routes.length);

      // Verify all routes are registered correctly
      routes.forEach(({ path, method }) => {
        const route = adapter.findRoute(path, method);
        expect(route).toBeDefined();
        expect(route?.path).toBe(path);
        expect(route?.method).toBe(method);
      });
    });

    it("should support RESTful API patterns", () => {
      const resourceName = "products";
      const restfulRoutes = [
        { method: "get" as HttpMethod, path: `/api/${resourceName}` }, // List
        { method: "post" as HttpMethod, path: `/api/${resourceName}` }, // Create
        { method: "get" as HttpMethod, path: `/api/${resourceName}/:id` }, // Read
        { method: "put" as HttpMethod, path: `/api/${resourceName}/:id` }, // Update
        { method: "patch" as HttpMethod, path: `/api/${resourceName}/:id` }, // Partial update
        { method: "delete" as HttpMethod, path: `/api/${resourceName}/:id` }, // Delete
      ];

      restfulRoutes.forEach(({ method, path }) => {
        const handler: RouteHandler = jest.fn();
        adapter.addRoute({ path, method, handler });
      });

      expect(adapter.getRegisteredRoutes()).toHaveLength(restfulRoutes.length);

      // Verify RESTful routes are properly registered
      restfulRoutes.forEach(({ method, path }) => {
        const route = adapter.findRoute(path, method);
        expect(route).toBeDefined();
      });
    });
  });
});
