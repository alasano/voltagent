/**
 * Options for configuring the Retriever
 */
export type RetrieverOptions = {
  /**
   * Name for the default tool created from this retriever
   * This is used for the pre-created 'tool' property
   * @default "search_knowledge"
   */
  toolName?: string;

  /**
   * Description for the default tool created from this retriever
   * This is used for the pre-created 'tool' property
   * @default "Searches for relevant information in the knowledge base based on the query."
   */
  toolDescription?: string;

  /**
   * Additional configuration specific to concrete retriever implementations
   */
  [key: string]: any;
};

/**
 * Options passed to retrieve method
 */
export interface RetrieveOptions {
  /**
   * User-managed context map for this specific retrieval operation
   * Can be used to store metadata, results, or any custom data
   */
  userContext?: Map<string | symbol, unknown>;
}

/**
 * Retriever interface for retrieving relevant information
 */
export type Retriever = {
  /**
   * Retrieve relevant documents based on input text
   * @param text The text to use for retrieval
   * @param options Configuration and context for the retrieval
   * @returns Promise resolving to a string with the retrieved content
   */
  retrieve(text: string, options: RetrieveOptions): Promise<string>;

  /**
   * Configuration options for the retriever
   * This is optional and may not be present in all implementations
   */
  options?: RetrieverOptions;

  /**
   * Pre-created tool for easy destructuring
   * This is optional and may not be present in all implementations
   */
  tool?: any;
};
