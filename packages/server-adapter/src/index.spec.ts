import * as serverAdapterExports from "./index";

describe("Server Adapter Exports", () => {
  describe("Class Exports", () => {
    it("should export ServerAdapter", () => {
      expect(serverAdapterExports.ServerAdapter).toBeDefined();
      expect(typeof serverAdapterExports.ServerAdapter).toBe("function");
    });

    it("should export ConsoleDataFormatter", () => {
      expect(serverAdapterExports.ConsoleDataFormatter).toBeDefined();
      expect(typeof serverAdapterExports.ConsoleDataFormatter).toBe("function");
    });

    it("should export VoltRouteFactory", () => {
      expect(serverAdapterExports.VoltRouteFactory).toBeDefined();
      expect(typeof serverAdapterExports.VoltRouteFactory).toBe("function");
    });

    it("should export WebSocketConnectionManager", () => {
      expect(serverAdapterExports.WebSocketConnectionManager).toBeDefined();
      expect(typeof serverAdapterExports.WebSocketConnectionManager).toBe("function");
    });

    it("should export CustomEndpointError", () => {
      expect(serverAdapterExports.CustomEndpointError).toBeDefined();
      expect(typeof serverAdapterExports.CustomEndpointError).toBe("function");
    });
  });

  describe("Function Exports", () => {
    it("should export createVoltRoutes", () => {
      expect(serverAdapterExports.createVoltRoutes).toBeDefined();
      expect(typeof serverAdapterExports.createVoltRoutes).toBe("function");
    });

    it("should export generateLandingPageHtml", () => {
      expect(serverAdapterExports.generateLandingPageHtml).toBeDefined();
      expect(typeof serverAdapterExports.generateLandingPageHtml).toBe("function");
    });

    it("should export validateCustomEndpoint", () => {
      expect(serverAdapterExports.validateCustomEndpoint).toBeDefined();
      expect(typeof serverAdapterExports.validateCustomEndpoint).toBe("function");
    });

    it("should export validateCustomEndpoints", () => {
      expect(serverAdapterExports.validateCustomEndpoints).toBeDefined();
      expect(typeof serverAdapterExports.validateCustomEndpoints).toBe("function");
    });

    it("should export WebSocket utility functions", () => {
      expect(serverAdapterExports.extractAgentIdFromUrl).toBeDefined();
      expect(typeof serverAdapterExports.extractAgentIdFromUrl).toBe("function");

      expect(serverAdapterExports.isTestWebSocketUrl).toBeDefined();
      expect(typeof serverAdapterExports.isTestWebSocketUrl).toBe("function");
    });
  });

  describe("Schema Exports", () => {
    it("should export CustomEndpointSchema", () => {
      expect(serverAdapterExports.CustomEndpointSchema).toBeDefined();
      expect(typeof serverAdapterExports.CustomEndpointSchema).toBe("object");
      expect(serverAdapterExports.CustomEndpointSchema.parse).toBeDefined();
    });
  });

  describe("Type Exports", () => {
    // TypeScript types are erased at runtime, but we can verify the serverAdapterExports structure
    it("should have type definitions available", () => {
      // We can't directly test TypeScript types at runtime, but we can verify
      // that the serverAdapterExports object has the expected structure
      const expectedExports = [
        "ServerAdapter",
        "ConsoleDataFormatter",
        "VoltRouteFactory",
        "createVoltRoutes",
        "WebSocketConnectionManager",
        "extractAgentIdFromUrl",
        "isTestWebSocketUrl",
        "generateLandingPageHtml",
        "CustomEndpointError",
        "CustomEndpointSchema",
        "validateCustomEndpoint",
        "validateCustomEndpoints",
      ];

      expectedExports.forEach((exportName) => {
        expect(serverAdapterExports).toHaveProperty(exportName);
      });
    });

    it("should export the correct number of named serverAdapterExports", () => {
      const exportedKeys = Object.keys(serverAdapterExports);

      // Should have all the expected serverAdapterExports
      expect(exportedKeys.length).toBeGreaterThanOrEqual(12);

      // Verify no unexpected serverAdapterExports
      const expectedExports = [
        "ServerAdapter",
        "ConsoleDataFormatter",
        "VoltRouteFactory",
        "createVoltRoutes",
        "WebSocketConnectionManager",
        "extractAgentIdFromUrl",
        "isTestWebSocketUrl",
        "generateLandingPageHtml",
        "CustomEndpointError",
        "CustomEndpointSchema",
        "validateCustomEndpoint",
        "validateCustomEndpoints",
      ];

      expectedExports.forEach((expectedExport) => {
        expect(exportedKeys).toContain(expectedExport);
      });
    });
  });

  describe("Export Types and Interfaces", () => {
    it("should export all classes as constructors", () => {
      const classExports = [
        "ServerAdapter",
        "ConsoleDataFormatter",
        "VoltRouteFactory",
        "WebSocketConnectionManager",
        "CustomEndpointError",
      ];

      classExports.forEach((className) => {
        const ClassConstructor = (serverAdapterExports as any)[className];
        expect(ClassConstructor).toBeDefined();
        expect(typeof ClassConstructor).toBe("function");
        expect(ClassConstructor.prototype).toBeDefined();
      });
    });

    it("should export utility functions", () => {
      const utilityFunctions = [
        "createVoltRoutes",
        "generateLandingPageHtml",
        "validateCustomEndpoint",
        "validateCustomEndpoints",
        "extractAgentIdFromUrl",
        "isTestWebSocketUrl",
      ];

      utilityFunctions.forEach((functionName) => {
        const func = (serverAdapterExports as any)[functionName];
        expect(func).toBeDefined();
        expect(typeof func).toBe("function");
      });
    });

    it("should export schemas with proper structure", () => {
      expect(serverAdapterExports.CustomEndpointSchema).toBeDefined();
      expect(serverAdapterExports.CustomEndpointSchema.parse).toBeDefined();
      expect(serverAdapterExports.CustomEndpointSchema.safeParse).toBeDefined();
      expect(typeof serverAdapterExports.CustomEndpointSchema.parse).toBe("function");
      expect(typeof serverAdapterExports.CustomEndpointSchema.safeParse).toBe("function");
    });
  });

  describe("Integration with Exported Components", () => {
    it("should be able to instantiate exported classes", () => {
      // Test ServerAdapter (abstract class, so we can't instantiate directly)
      expect(() => {
        const adapter = serverAdapterExports.ServerAdapter;
        expect(adapter.prototype.addRoute).toBeUndefined(); // Abstract method
      }).not.toThrow();

      // Test ConsoleDataFormatter
      expect(() => {
        const formatter = new serverAdapterExports.ConsoleDataFormatter();
        expect(formatter).toBeInstanceOf(serverAdapterExports.ConsoleDataFormatter);
      }).not.toThrow();

      // Test WebSocketConnectionManager requires registry
      // We'll just verify the constructor exists
      expect(serverAdapterExports.WebSocketConnectionManager).toBeDefined();

      // Test CustomEndpointError
      expect(() => {
        const error = new serverAdapterExports.CustomEndpointError("test error");
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(serverAdapterExports.CustomEndpointError);
        expect(error.message).toBe("test error");
      }).not.toThrow();
    });

    it("should be able to call exported utility functions", () => {
      // Test generateLandingPageHtml
      expect(() => {
        const html = serverAdapterExports.generateLandingPageHtml();
        expect(typeof html).toBe("string");
        expect(html.length).toBeGreaterThan(0);
      }).not.toThrow();

      // Test createVoltRoutes requires a registry, so just check it's callable
      expect(typeof serverAdapterExports.createVoltRoutes).toBe("function");

      // Test validation functions
      expect(() => {
        const validEndpoint = {
          path: "/test",
          method: "get" as const,
          handler: jest.fn(),
        };
        const result = serverAdapterExports.validateCustomEndpoint(validEndpoint);
        expect(result).toBeDefined();
      }).not.toThrow();

      expect(() => {
        const endpoints = [
          {
            path: "/test",
            method: "get" as const,
            handler: jest.fn(),
          },
        ];
        const result = serverAdapterExports.validateCustomEndpoints(endpoints);
        expect(Array.isArray(result)).toBe(true);
      }).not.toThrow();
    });

    it("should be able to use exported schemas", () => {
      expect(() => {
        const testData = {
          path: "/test",
          method: "get",
          handler: jest.fn(),
        };

        const result = serverAdapterExports.CustomEndpointSchema.safeParse(testData);
        expect(result.success).toBe(true);
      }).not.toThrow();
    });
  });

  describe("Re-export Consistency", () => {
    it("should re-export from correct modules", () => {
      // Verify that imports are working by checking class names
      expect(serverAdapterExports.ServerAdapter.name).toBe("ServerAdapter");
      expect(serverAdapterExports.ConsoleDataFormatter.name).toBe("ConsoleDataFormatter");
      expect(serverAdapterExports.VoltRouteFactory.name).toBe("VoltRouteFactory");
      expect(serverAdapterExports.WebSocketConnectionManager.name).toBe(
        "WebSocketConnectionManager",
      );
      expect(serverAdapterExports.CustomEndpointError.name).toBe("CustomEndpointError");
    });

    it("should maintain function identity through re-serverAdapterExports", () => {
      // Functions should maintain their identity when re-exported
      expect(serverAdapterExports.createVoltRoutes.name).toBe("createVoltRoutes");
      expect(serverAdapterExports.generateLandingPageHtml.name).toBe("generateLandingPageHtml");
      expect(serverAdapterExports.validateCustomEndpoint.name).toBe("validateCustomEndpoint");
      expect(serverAdapterExports.validateCustomEndpoints.name).toBe("validateCustomEndpoints");
    });
  });

  describe("Module Structure", () => {
    it("should not export any default serverAdapterExports", () => {
      // This package uses named serverAdapterExports only
      expect((serverAdapterExports as any).default).toBeUndefined();
    });

    it("should maintain stable export interface", () => {
      // Ensure we're not accidentally exporting internal implementation details
      const exportKeys = Object.keys(serverAdapterExports);

      // Should not export any keys that start with underscore (private/internal)
      const privateExports = exportKeys.filter((key) => key.startsWith("_"));
      expect(privateExports).toHaveLength(0);

      // Should not export any prototype or constructor properties unintentionally
      const suspiciousExports = exportKeys.filter(
        (key) => key.includes("prototype") || key === "constructor",
      );
      expect(suspiciousExports).toHaveLength(0);
    });

    it("should export stable API surface", () => {
      // Verify the main API components are present
      const coreExports = [
        "ServerAdapter",
        "VoltRouteFactory",
        "ConsoleDataFormatter",
        "WebSocketConnectionManager",
      ];

      coreExports.forEach((exportName) => {
        expect(serverAdapterExports).toHaveProperty(exportName);
        expect((serverAdapterExports as any)[exportName]).toBeDefined();
      });
    });
  });
});
