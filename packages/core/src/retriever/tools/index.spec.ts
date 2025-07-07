import type { Retriever } from "../types";
import { createRetrieverTool } from "./index";

describe("createRetrieverTool", () => {
  // Mock retriever for testing
  const createMockRetriever = (results: string) => {
    return {
      retrieve: jest.fn().mockResolvedValue(results),
    } as Retriever;
  };

  it("should create a tool with default name and description", () => {
    // Arrange
    const mockRetriever = createMockRetriever("Test content 1");

    // Act
    const tool = createRetrieverTool(mockRetriever);

    // Assert
    expect(tool.name).toBe("search_knowledge");
    expect(tool.description).toBe(
      "Searches for relevant information in the knowledge base based on the query.",
    );
    expect(tool.parameters).toBeDefined();
    expect(typeof tool.execute).toBe("function");
  });

  it("should create a tool with custom name and description", () => {
    // Arrange
    const mockRetriever = createMockRetriever("Test content 1");
    const customName = "custom_search";
    const customDescription = "Custom search description";

    // Act
    const tool = createRetrieverTool(mockRetriever, {
      name: customName,
      description: customDescription,
    });

    // Assert
    expect(tool.name).toBe(customName);
    expect(tool.description).toBe(customDescription);
  });

  it("should call the retriever's retrieve method with query and options", async () => {
    // Arrange
    const mockResults: string = "Test content 1";
    const mockRetriever = createMockRetriever(mockResults);
    const tool = createRetrieverTool(mockRetriever);
    const query = "test query";

    // Act
    await tool.execute({ query });

    // Assert
    expect(mockRetriever.retrieve).toHaveBeenCalledWith(query, {
      userContext: undefined,
    });
    expect(mockRetriever.retrieve).toHaveBeenCalledTimes(1);
  });

  it("should pass userContext from executeOptions to retriever", async () => {
    // Arrange
    const mockResults: string = "Test content with context";
    const mockRetriever = createMockRetriever(mockResults);
    const tool = createRetrieverTool(mockRetriever);
    const query = "test query";

    // Mock userContext
    const userContext = new Map<string | symbol, unknown>();
    const executeOptions = {
      operationContext: {
        userContext,
        operationId: "test-op",
        historyEntry: {} as any,
        isActive: true,
      },
    };

    // Act
    await tool.execute({ query }, executeOptions);

    // Assert
    expect(mockRetriever.retrieve).toHaveBeenCalledWith(query, {
      userContext,
    });
  });

  it("should handle missing executeOptions gracefully", async () => {
    // Arrange
    const mockResults: string = "Test content";
    const mockRetriever = createMockRetriever(mockResults);
    const tool = createRetrieverTool(mockRetriever);
    const query = "test query";

    // Act
    const result = await tool.execute({ query }, undefined);

    // Assert
    expect(mockRetriever.retrieve).toHaveBeenCalledWith(query, {
      userContext: undefined,
    });
    expect(result).toBe("Test content");
  });

  it("should format retrieval results correctly", async () => {
    // Arrange
    const mockResults: string = "Test content 1";
    const mockRetriever = createMockRetriever(mockResults);
    const tool = createRetrieverTool(mockRetriever);

    // Act
    const result = await tool.execute({ query: "test" });

    // Assert
    expect(result).toBe("Test content 1");
  });

  it("should handle empty results from retriever", async () => {
    // Arrange
    const mockRetriever = createMockRetriever("");
    const tool = createRetrieverTool(mockRetriever);

    // Act
    const result = await tool.execute({ query: "test" });

    // Assert
    expect(result).toBe("");
  });

  it("should handle results with metadata", async () => {
    // Arrange
    const mockResults: string = "Test content with metadata";
    const mockRetriever = createMockRetriever(mockResults);
    const tool = createRetrieverTool(mockRetriever);

    // Act
    const result = await tool.execute({ query: "test" });

    // Assert
    expect(result).toBe("Test content with metadata");
  });
});
