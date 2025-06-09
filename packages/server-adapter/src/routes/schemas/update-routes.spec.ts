import { checkUpdatesRoute, updateAllRoute, updateSingleRoute } from "./update-routes";
import type { RouteContext } from "../../types";

// Mock the core package update functions
jest.mock("@voltagent/core", () => ({
  checkForUpdates: jest.fn(),
  updateAllPackages: jest.fn(),
  updateSinglePackage: jest.fn(),
}));

// Local mock creation functions
function createMockRouteContext(overrides: any = {}): RouteContext {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    ...overrides,
  };
}

describe("Update Routes", () => {
  let mockCheckForUpdates: jest.Mock;
  let mockUpdateAllPackages: jest.Mock;
  let mockUpdateSinglePackage: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    const voltagentCore = require("@voltagent/core");
    mockCheckForUpdates = voltagentCore.checkForUpdates;
    mockUpdateAllPackages = voltagentCore.updateAllPackages;
    mockUpdateSinglePackage = voltagentCore.updateSinglePackage;
  });

  describe("checkUpdatesRoute", () => {
    it("should have correct route definition", () => {
      expect(checkUpdatesRoute.method).toBe("get");
      expect(checkUpdatesRoute.path).toBe("/updates");
      expect(checkUpdatesRoute.openapi).toBeDefined();
      expect(checkUpdatesRoute.openapi?.tags).toContain("System Management");
      expect(checkUpdatesRoute.openapi?.summary).toBe("Check for updates");
    });

    it("should check for updates successfully when no updates available", async () => {
      mockCheckForUpdates.mockResolvedValue({
        hasUpdates: false,
        updates: [],
        count: 0,
      });

      const context = createMockRouteContext();
      const result = await checkUpdatesRoute.handler({}, context);

      expect(mockCheckForUpdates).toHaveBeenCalled();
      expect(result).toEqual({
        hasUpdates: false,
        updates: [],
        count: 0,
      });
    });

    it("should check for updates successfully when updates available", async () => {
      const mockUpdates = [
        {
          packageName: "@voltagent/core",
          currentVersion: "1.0.0",
          latestVersion: "1.1.0",
          updateType: "minor",
        },
        {
          packageName: "@voltagent/server-adapter",
          currentVersion: "0.1.0",
          latestVersion: "0.2.0",
          updateType: "minor",
        },
      ];

      mockCheckForUpdates.mockResolvedValue({
        hasUpdates: true,
        updates: mockUpdates,
        count: 2,
      });

      const context = createMockRouteContext();
      const result = await checkUpdatesRoute.handler({}, context);

      expect(mockCheckForUpdates).toHaveBeenCalled();
      expect(result).toEqual({
        hasUpdates: true,
        updates: mockUpdates,
        count: 2,
      });
    });

    it("should handle update check errors", async () => {
      mockCheckForUpdates.mockRejectedValue(new Error("Failed to check updates"));

      const context = createMockRouteContext();

      await expect(checkUpdatesRoute.handler({}, context)).rejects.toThrow(
        "Failed to check updates",
      );

      expect(mockCheckForUpdates).toHaveBeenCalled();
    });

    it("should handle empty update results", async () => {
      mockCheckForUpdates.mockResolvedValue({
        hasUpdates: false,
        updates: [],
        count: 0,
      });

      const context = createMockRouteContext();
      const result = await checkUpdatesRoute.handler({}, context);

      expect(result.hasUpdates).toBe(false);
      expect(result.updates).toEqual([]);
      expect(result.count).toBe(0);
    });
  });

  describe("updateAllRoute", () => {
    it("should have correct route definition", () => {
      expect(updateAllRoute.method).toBe("post");
      expect(updateAllRoute.path).toBe("/updates");
      expect(updateAllRoute.openapi).toBeDefined();
      expect(updateAllRoute.openapi?.summary).toBe("Update all packages");
    });

    it("should update all packages successfully", async () => {
      mockUpdateAllPackages.mockResolvedValue({
        message: "All packages updated successfully",
        updatedPackages: ["@voltagent/core", "@voltagent/server-adapter"],
      });

      const context = createMockRouteContext();
      const result = await updateAllRoute.handler({}, context);

      expect(mockUpdateAllPackages).toHaveBeenCalled();
      expect(result).toMatchObject({
        message: "All packages updated successfully",
        updatedPackages: ["@voltagent/core", "@voltagent/server-adapter"],
        updatedAt: expect.any(String),
      });

      // Verify updatedAt is a valid ISO string
      expect(new Date(result.updatedAt).toISOString()).toBe(result.updatedAt);
    });

    it("should handle updates with no packages updated", async () => {
      mockUpdateAllPackages.mockResolvedValue({
        message: "No packages needed updating",
        updatedPackages: [],
      });

      const context = createMockRouteContext();
      const result = await updateAllRoute.handler({}, context);

      expect(result).toMatchObject({
        message: "No packages needed updating",
        updatedPackages: [],
        updatedAt: expect.any(String),
      });
    });

    it("should handle updates with missing updatedPackages field", async () => {
      mockUpdateAllPackages.mockResolvedValue({
        message: "Update completed",
        // updatedPackages field missing
      });

      const context = createMockRouteContext();
      const result = await updateAllRoute.handler({}, context);

      expect(result).toMatchObject({
        message: "Update completed",
        updatedPackages: [], // Should default to empty array
        updatedAt: expect.any(String),
      });
    });

    it("should handle update errors", async () => {
      mockUpdateAllPackages.mockRejectedValue(new Error("Update process failed"));

      const context = createMockRouteContext();

      await expect(updateAllRoute.handler({}, context)).rejects.toThrow("Update process failed");

      expect(mockUpdateAllPackages).toHaveBeenCalled();
    });
  });

  describe("updateSingleRoute", () => {
    it("should have correct route definition", () => {
      expect(updateSingleRoute.method).toBe("post");
      expect(updateSingleRoute.path).toBe("/updates/{packageName}");
      expect(updateSingleRoute.openapi).toBeDefined();
      expect(updateSingleRoute.openapi?.request?.params).toBeDefined();
      expect(updateSingleRoute.openapi?.summary).toBe("Update single package");
    });

    it("should update single package successfully", async () => {
      mockUpdateSinglePackage.mockResolvedValue({
        message: "Package @voltagent/core updated successfully",
        packageName: "@voltagent/core",
      });

      const params = { packageName: "@voltagent/core" };
      const context = createMockRouteContext();
      const result = await updateSingleRoute.handler(params, context);

      expect(mockUpdateSinglePackage).toHaveBeenCalledWith("@voltagent/core");
      expect(result).toMatchObject({
        message: "Package @voltagent/core updated successfully",
        packageName: "@voltagent/core",
        updatedAt: expect.any(String),
      });

      // Verify updatedAt is a valid ISO string
      expect(new Date(result.updatedAt).toISOString()).toBe(result.updatedAt);
    });

    it("should handle different package names", async () => {
      const packageNames = [
        "@voltagent/core",
        "@voltagent/server-adapter",
        "@voltagent/server-hono",
        "some-other-package",
      ];

      for (const packageName of packageNames) {
        mockUpdateSinglePackage.mockResolvedValue({
          message: `Package ${packageName} updated successfully`,
          packageName,
        });

        const params = { packageName };
        const context = createMockRouteContext();
        const result = await updateSingleRoute.handler(params, context);

        expect(mockUpdateSinglePackage).toHaveBeenCalledWith(packageName);
        expect(result.packageName).toBe(packageName);
        expect(result.message).toContain(packageName);
      }
    });

    it("should handle package update errors", async () => {
      mockUpdateSinglePackage.mockRejectedValue(new Error("Package not found"));

      const params = { packageName: "non-existent-package" };
      const context = createMockRouteContext();

      await expect(updateSingleRoute.handler(params, context)).rejects.toThrow("Package not found");

      expect(mockUpdateSinglePackage).toHaveBeenCalledWith("non-existent-package");
    });

    it("should handle network errors during update", async () => {
      mockUpdateSinglePackage.mockRejectedValue(new Error("Network error"));

      const params = { packageName: "@voltagent/core" };
      const context = createMockRouteContext();

      await expect(updateSingleRoute.handler(params, context)).rejects.toThrow("Network error");
    });

    it("should handle update with missing packageName in result", async () => {
      mockUpdateSinglePackage.mockResolvedValue({
        message: "Update completed",
        // packageName field missing
      });

      const params = { packageName: "@voltagent/core" };
      const context = createMockRouteContext();
      const result = await updateSingleRoute.handler(params, context);

      expect(result).toMatchObject({
        message: "Update completed",
        packageName: undefined, // Should be undefined when not returned
        updatedAt: expect.any(String),
      });
    });
  });

  describe("Route OpenAPI schemas", () => {
    it("should have proper response schemas for checkUpdatesRoute", () => {
      const openapi = checkUpdatesRoute.openapi;
      expect(openapi?.responses).toBeDefined();
      expect(openapi?.responses[200]).toBeDefined();
      expect(openapi?.responses[500]).toBeDefined();
      expect(openapi?.responses[200].description).toBe("Update check results");
    });

    it("should have proper response schemas for updateAllRoute", () => {
      const openapi = updateAllRoute.openapi;
      expect(openapi?.responses).toBeDefined();
      expect(openapi?.responses[200]).toBeDefined();
      expect(openapi?.responses[500]).toBeDefined();
      expect(openapi?.responses[200].description).toBe("Update completed successfully");
    });

    it("should have proper request/response schemas for updateSingleRoute", () => {
      const openapi = updateSingleRoute.openapi;
      expect(openapi?.request?.params).toBeDefined();
      expect(openapi?.responses).toBeDefined();
      expect(openapi?.responses[200]).toBeDefined();
      expect(openapi?.responses[500]).toBeDefined();
    });

    it("should have appropriate tags for all update routes", () => {
      const routes = [checkUpdatesRoute, updateAllRoute, updateSingleRoute];

      routes.forEach((route) => {
        expect(route.openapi?.tags).toBeDefined();
        expect(route.openapi?.tags).toContain("System Management");
      });
    });

    it("should have descriptive summaries and descriptions", () => {
      const routes = [
        { route: checkUpdatesRoute, summary: "Check for updates" },
        { route: updateAllRoute, summary: "Update all packages" },
        { route: updateSingleRoute, summary: "Update single package" },
      ];

      routes.forEach(({ route, summary }) => {
        expect(route.openapi?.summary).toBe(summary);
        expect(route.openapi?.description).toBeDefined();
        expect(route.openapi?.description?.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complete update workflow", async () => {
      // Check for updates
      mockCheckForUpdates.mockResolvedValue({
        hasUpdates: true,
        updates: [
          {
            packageName: "@voltagent/core",
            currentVersion: "1.0.0",
            latestVersion: "1.1.0",
            updateType: "minor",
          },
        ],
        count: 1,
      });

      const checkResult = await checkUpdatesRoute.handler({}, createMockRouteContext());
      expect(checkResult.hasUpdates).toBe(true);
      expect(checkResult.count).toBe(1);

      // Update all packages
      mockUpdateAllPackages.mockResolvedValue({
        message: "All packages updated",
        updatedPackages: ["@voltagent/core"],
      });

      const updateAllResult = await updateAllRoute.handler({}, createMockRouteContext());
      expect(updateAllResult.message).toBe("All packages updated");
      expect(updateAllResult.updatedPackages).toContain("@voltagent/core");

      // Verify all core functions were called
      expect(mockCheckForUpdates).toHaveBeenCalled();
      expect(mockUpdateAllPackages).toHaveBeenCalled();
    });

    it("should handle single package update workflow", async () => {
      const packageName = "@voltagent/server-adapter";

      mockUpdateSinglePackage.mockResolvedValue({
        message: `Package ${packageName} updated to latest version`,
        packageName,
      });

      const params = { packageName };
      const result = await updateSingleRoute.handler(params, createMockRouteContext());

      expect(result.packageName).toBe(packageName);
      expect(result.message).toContain(packageName);
      expect(mockUpdateSinglePackage).toHaveBeenCalledWith(packageName);
    });
  });
});
