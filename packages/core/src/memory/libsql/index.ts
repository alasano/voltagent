import { existsSync } from "node:fs";
import fs from "node:fs";
import { join } from "node:path";
import type { Client, Row } from "@libsql/client";
import { createClient } from "@libsql/client";
import type { NewTimelineEvent } from "../../events/types";
import { safeJsonParse } from "../../utils";
import devLogger from "../../utils/internal/dev-logger";
import type { BaseMessage } from "../../agent/providers/base/types";
import type {
  Conversation,
  ConversationQueryOptions,
  CreateConversationInput,
  Memory,
  MemoryMessage,
  MemoryOptions,
  MessageFilterOptions,
} from "../types";

/**
 * LibSQL Storage for VoltAgent
 *
 * This implementation provides:
 * - Conversation management with user support
 * - Automatic migration from old schema to new schema
 * - Query builder pattern for flexible data retrieval
 * - Pagination support
 *
 * @see {@link https://voltagent.ai/docs/agents/memory/libsql | LibSQL Storage Documentation}
 * Function to add a delay between 0-0 seconds for debugging
 */
async function debugDelay(): Promise<void> {
  const min = 0; // 0 seconds
  const max = 0; // 0 seconds
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Options for configuring the LibSQLStorage
 */
export interface LibSQLStorageOptions extends MemoryOptions {
  /**
   * LibSQL connection URL
   * Can be either a remote Turso URL or a local file path
   * @example "libsql://your-database.turso.io" for remote Turso
   * @example "file:memory.db" for local SQLite in current directory
   * @example "file:.voltagent/memory.db" for local SQLite in .voltagent folder
   */
  url: string;

  /**
   * Auth token for LibSQL/Turso
   * Not needed for local SQLite
   */
  authToken?: string;

  /**
   * Prefix for table names
   * @default "voltagent_memory"
   */
  tablePrefix?: string;

  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Storage limit for the LibSQLStorage
   * @default 100
   */
  storageLimit?: number;
}

/**
 * A LibSQL storage implementation of the Memory interface
 * Uses libsql/Turso to store and retrieve conversation history
 *
 * This implementation automatically handles both:
 * - Remote Turso databases (with libsql:// URLs)
 * - Local SQLite databases (with file: URLs)
 */
export class LibSQLStorage implements Memory {
  private client: Client;
  private options: LibSQLStorageOptions;
  private initialized: Promise<void>;

  /**
   * Create a new LibSQL storage
   * @param options Configuration options
   */
  constructor(options: LibSQLStorageOptions) {
    this.options = {
      storageLimit: options.storageLimit || 100,
      tablePrefix: options.tablePrefix || "voltagent_memory",
      debug: options.debug || false,
      url: this.normalizeUrl(options.url),
      authToken: options.authToken,
    };

    // Initialize the LibSQL client
    this.client = createClient({
      url: this.options.url,
      authToken: this.options.authToken,
    });

    this.debug("LibSQL storage provider initialized with options", this.options);

    // Initialize the database tables
    this.initialized = this.initializeDatabase();
  }

  /**
   * Normalize the URL for SQLite database
   * - Ensures local files exist in the correct directory
   * - Creates the .voltagent directory if needed for default storage
   */
  private normalizeUrl(url: string): string {
    // If it's a remote URL, return as is
    if (url.startsWith("libsql://")) {
      return url;
    }

    // Handle file URLs
    if (url.startsWith("file:")) {
      const filePath = url.substring(5); // Remove 'file:' prefix

      // If it's a relative path without directory separators, use the default .voltagent directory
      if (!filePath.includes("/") && !filePath.includes("\\")) {
        try {
          // Create .voltagent directory if it doesn't exist
          const dirPath = join(process.cwd(), ".voltagent");
          if (!existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }
          return `file:${join(dirPath, filePath)}`;
        } catch (error) {
          // If we can't create the directory, fall back to current directory
          this.debug("Failed to create .voltagent directory, using current directory", error);
          return url;
        }
      }
    }

    return url;
  }

  /**
   * Log a debug message if debug is enabled
   * @param message Message to log
   * @param data Additional data to log
   */
  private debug(message: string, data?: unknown): void {
    if (this.options?.debug) {
      devLogger.info(`[LibSQLStorage] ${message}`, data || "");
    }
  }

  /**
   * Initialize the database tables
   * @returns Promise that resolves when initialization is complete
   */
  private async initializeDatabase(): Promise<void> {
    // Create conversations table if it doesn't exist
    const conversationsTableName = `${this.options.tablePrefix}_conversations`;

    await this.client.execute(`
        CREATE TABLE IF NOT EXISTS ${conversationsTableName} (
          id TEXT PRIMARY KEY,
          resource_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          metadata TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

    // Create messages table if it doesn't exist
    const messagesTableName = `${this.options.tablePrefix}_messages`;

    await this.client.execute(`
        CREATE TABLE IF NOT EXISTS ${messagesTableName} (
          conversation_id TEXT NOT NULL,
          message_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          type TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (conversation_id, message_id)
        )
      `);

    // Create agent_history table
    const historyTableName = `${this.options.tablePrefix}_agent_history`;
    await this.client.execute(`
        CREATE TABLE IF NOT EXISTS ${historyTableName} (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          status TEXT,
          input TEXT,
          output TEXT,
          usage TEXT,
          metadata TEXT
        )
      `);

    // Create agent_history_steps table
    const historyStepsTableName = `${this.options.tablePrefix}_agent_history_steps`;
    await this.client.execute(`
        CREATE TABLE IF NOT EXISTS ${historyStepsTableName} (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          history_id TEXT NOT NULL,
          agent_id TEXT
        )
      `);

    // Create timeline events table
    const timelineEventsTableName = `${this.options.tablePrefix}_agent_history_timeline_events`;
    await this.client.execute(`
        CREATE TABLE IF NOT EXISTS ${timelineEventsTableName} (
          id TEXT PRIMARY KEY,
          history_id TEXT NOT NULL,
          agent_id TEXT,
          event_type TEXT NOT NULL,
          event_name TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT,
          status TEXT,
          status_message TEXT,
          level TEXT,
          version TEXT,
          parent_event_id TEXT,
          tags TEXT,
          input TEXT,
          output TEXT,
          error TEXT,
          metadata TEXT
        )
      `);

    // Create index for faster queries
    await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${messagesTableName}_lookup
        ON ${messagesTableName}(conversation_id, created_at)
      `);

    // Create index for conversations
    await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${conversationsTableName}_resource
        ON ${conversationsTableName}(resource_id)
      `);

    // Create index for conversations by user_id (only if user_id column exists)
    try {
      const tableInfo = await this.client.execute(`PRAGMA table_info(${conversationsTableName})`);

      const hasUserIdColumn = tableInfo.rows.some((row) => row.name === "user_id");

      if (hasUserIdColumn) {
        await this.client.execute(`
          CREATE INDEX IF NOT EXISTS idx_${conversationsTableName}_user
          ON ${conversationsTableName}(user_id)
        `);
      }
    } catch (error) {
      this.debug("Error creating user_id index, will be created after migration:", error);
    }

    // Create indexes for history tables

    await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${historyStepsTableName}_history_id 
        ON ${historyStepsTableName}(history_id)
      `);

    // Create indexes for agent_id for more efficient querying
    await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${historyTableName}_agent_id 
        ON ${historyTableName}(agent_id)
      `);

    await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${historyStepsTableName}_agent_id 
        ON ${historyStepsTableName}(agent_id)
      `);

    // Create indexes for timeline events table
    await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${timelineEventsTableName}_history_id 
        ON ${timelineEventsTableName}(history_id)
      `);

    await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${timelineEventsTableName}_agent_id 
        ON ${timelineEventsTableName}(agent_id)
      `);

    await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${timelineEventsTableName}_event_type 
        ON ${timelineEventsTableName}(event_type)
      `);

    await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${timelineEventsTableName}_event_name 
        ON ${timelineEventsTableName}(event_name)
      `);

    await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${timelineEventsTableName}_parent_event_id 
        ON ${timelineEventsTableName}(parent_event_id)
      `);

    await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${timelineEventsTableName}_status 
        ON ${timelineEventsTableName}(status)
      `);

    this.debug("Database initialized successfully");

    // Run conversation schema migration first
    try {
      const migrationResult = await this.migrateConversationSchema({
        createBackup: true,
        deleteBackupAfterSuccess: true,
      });

      if (migrationResult.success) {
        if ((migrationResult.migratedCount || 0) > 0) {
          devLogger.info(
            `${migrationResult.migratedCount} conversation records successfully migrated`,
          );
        }
      } else {
        devLogger.error("Conversation migration error:", migrationResult.error);
      }
    } catch (error) {
      this.debug("Error migrating conversation schema:", error);
    }

    try {
      const result = await this.migrateAgentHistoryData({
        restoreFromBackup: false,
      });

      if (result.success) {
        if ((result.migratedCount || 0) > 0) {
          devLogger.info(`${result.migratedCount} records successfully migrated`);
        }
      } else {
        devLogger.error("Migration error:", result.error);

        // Restore from backup in case of error
        const restoreResult = await this.migrateAgentHistoryData({});

        if (restoreResult.success) {
          devLogger.info("Successfully restored from backup");
        }
      }
    } catch (error) {
      this.debug("Error initializing database:", error);
      //throw new Error("Failed to initialize LibSQL database");
    }
  }

  /**
   * Generate a unique ID for a message
   * @returns Unique ID
   */
  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Get messages with filtering options
   * @param options Filtering options
   * @returns Filtered messages
   */
  async getMessages(options: MessageFilterOptions = {}): Promise<MemoryMessage[]> {
    // Wait for database initialization
    await this.initialized;

    // Add delay for debugging
    await debugDelay();

    const {
      userId = "default",
      conversationId = "default",
      limit = this.options.storageLimit,
      before,
      after,
      role,
    } = options;

    const messagesTableName = `${this.options.tablePrefix}_messages`;
    const conversationsTableName = `${this.options.tablePrefix}_conversations`;

    try {
      let sql = `
        SELECT m.message_id, m.role, m.content, m.type, m.created_at, m.conversation_id
        FROM ${messagesTableName} m
      `;
      const args: any[] = [];
      const conditions: string[] = [];

      // If userId is specified, we need to join with conversations table
      if (userId !== "default") {
        sql += ` INNER JOIN ${conversationsTableName} c ON m.conversation_id = c.id`;
        conditions.push("c.user_id = ?");
        args.push(userId);
      }

      // Add conversation_id filter
      if (conversationId !== "default") {
        conditions.push("m.conversation_id = ?");
        args.push(conversationId);
      }

      // Add time-based filters
      if (before) {
        conditions.push("m.created_at < ?");
        args.push(new Date(before).toISOString());
      }

      if (after) {
        conditions.push("m.created_at > ?");
        args.push(new Date(after).toISOString());
      }

      // Add role filter
      if (role) {
        conditions.push("m.role = ?");
        args.push(role);
      }

      // Add WHERE clause if we have conditions
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(" AND ")}`;
      }

      // Add ordering and limit
      sql += " ORDER BY m.created_at ASC";
      if (limit && limit > 0) {
        sql += " LIMIT ?";
        args.push(limit);
      }

      const result = await this.client.execute({
        sql,
        args,
      });

      return result.rows.map((row) => ({
        id: row.message_id as string,
        role: row.role as BaseMessage["role"],
        content: row.content as string,
        type: row.type as "text" | "tool-call" | "tool-result",
        createdAt: row.created_at as string,
      }));
    } catch (error) {
      this.debug("Error getting messages:", error);
      throw new Error("Failed to get messages from LibSQL database");
    }
  }

  /**
   * Add a message to the conversation history
   * @param message Message to add
   * @param userId User identifier (optional, defaults to "default")
   * @param conversationId Conversation identifier (optional, defaults to "default")
   */
  async addMessage(
    message: MemoryMessage,
    userId = "default",
    conversationId = "default",
  ): Promise<void> {
    // Wait for database initialization
    await this.initialized;

    // Add delay for debugging
    await debugDelay();

    const tableName = `${this.options.tablePrefix}_messages`;

    try {
      await this.client.execute({
        sql: `INSERT INTO ${tableName} (conversation_id, message_id, role, content, type, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          conversationId,
          message.id,
          message.role,
          message.content as string,
          message.type,
          message.createdAt,
        ],
      });

      this.debug("Message added successfully", { userId, conversationId, messageId: message.id });

      // Optionally, prune old messages to respect storage limit
      try {
        await this.pruneOldMessages(conversationId);
      } catch (pruneError) {
        this.debug("Error pruning old messages:", pruneError);
        // Don't throw error for pruning failure
      }
    } catch (error) {
      this.debug("Error adding message:", error);
      throw new Error("Failed to add message to LibSQL database");
    }
  }

  /**
   * Prune old messages to respect storage limit
   * @param conversationId Conversation ID to prune messages for
   */
  private async pruneOldMessages(conversationId: string): Promise<void> {
    const limit = this.options.storageLimit || 100;
    const tableName = `${this.options.tablePrefix}_messages`;

    try {
      // Get the count of messages for this conversation
      const countResult = await this.client.execute({
        sql: `SELECT COUNT(*) as count FROM ${tableName} WHERE conversation_id = ?`,
        args: [conversationId],
      });

      const messageCount = countResult.rows[0]?.count as number;

      if (messageCount > limit) {
        // Delete the oldest messages beyond the limit
        const deleteCount = messageCount - limit;

        await this.client.execute({
          sql: `DELETE FROM ${tableName} 
                WHERE conversation_id = ? 
                AND message_id IN (
                  SELECT message_id FROM ${tableName} 
                  WHERE conversation_id = ? 
                  ORDER BY created_at ASC 
                  LIMIT ?
                )`,
          args: [conversationId, conversationId, deleteCount],
        });

        this.debug(`Pruned ${deleteCount} old messages for conversation ${conversationId}`);
      }
    } catch (error) {
      this.debug("Error pruning old messages:", error);
      throw error;
    }
  }

  /**
   * Clear messages from memory
   */
  async clearMessages(options: { userId: string; conversationId?: string }): Promise<void> {
    // Wait for database initialization
    await this.initialized;

    // Add delay for debugging
    await debugDelay();

    const { userId, conversationId } = options;
    const messagesTableName = `${this.options.tablePrefix}_messages`;
    const conversationsTableName = `${this.options.tablePrefix}_conversations`;

    try {
      if (conversationId) {
        // Clear messages for a specific conversation (with user validation)
        await this.client.execute({
          sql: `DELETE FROM ${messagesTableName} 
                WHERE conversation_id = ? 
                AND conversation_id IN (
                  SELECT id FROM ${conversationsTableName} WHERE user_id = ?
                )`,
          args: [conversationId, userId],
        });
        this.debug(`Cleared messages for conversation ${conversationId} for user ${userId}`);
      } else {
        // Clear all messages for the user across all their conversations
        await this.client.execute({
          sql: `DELETE FROM ${messagesTableName} 
                WHERE conversation_id IN (
                  SELECT id FROM ${conversationsTableName} WHERE user_id = ?
                )`,
          args: [userId],
        });
        this.debug(`Cleared all messages for user ${userId}`);
      }
    } catch (error) {
      this.debug("Error clearing messages:", error);
      throw new Error("Failed to clear messages from LibSQL database");
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.client.close();
  }

  /**
   * Add or update a history entry
   * @param key Entry ID
   * @param value Entry data
   * @param agentId Agent ID for filtering
   */
  async addHistoryEntry(key: string, value: any, agentId: string): Promise<void> {
    await this.initialized;

    try {
      const tableName = `${this.options.tablePrefix}_agent_history`;

      // Normalize the data for storage
      const inputJSON = value.input ? JSON.stringify(value.input) : null;
      const outputJSON = value.output ? JSON.stringify(value.output) : null;
      const usageJSON = value.usage ? JSON.stringify(value.usage) : null;
      const metadataJSON = value.metadata ? JSON.stringify(value.metadata) : null;

      // Insert or replace with the structured format
      await this.client.execute({
        sql: `INSERT OR REPLACE INTO ${tableName} 
					(id, agent_id, timestamp, status, input, output, usage, metadata) 
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          key, // id
          agentId, // agent_id
          value.timestamp ? value.timestamp.toISOString() : new Date().toISOString(), // timestamp
          value.status || null, // status
          inputJSON, // input
          outputJSON, // output
          usageJSON, // usage
          metadataJSON, // metadata
        ],
      });

      this.debug(`Set agent_history entry with ID ${key} for agent ${agentId}`);
    } catch (error) {
      this.debug("Error setting agent_history entry:", error);
      throw new Error("Failed to set value in agent_history");
    }
  }

  /**
   * Update an existing history entry
   * @param key Entry ID
   * @param value Updated entry data
   * @param agentId Agent ID for filtering
   */
  async updateHistoryEntry(key: string, value: any, agentId: string): Promise<void> {
    // Same implementation as addHistoryEntry since it uses INSERT OR REPLACE
    return this.addHistoryEntry(key, value, agentId);
  }

  /**
   * Add a history step
   * @param key Step ID
   * @param value Step data
   * @param historyId Related history entry ID
   * @param agentId Agent ID for filtering
   */
  async addHistoryStep(key: string, value: any, historyId: string, agentId: string): Promise<void> {
    await this.initialized;

    try {
      const tableName = `${this.options.tablePrefix}_agent_history_steps`;

      // Serialize value to JSON
      const serializedValue = JSON.stringify(value);

      // Insert or replace with history_id and agent_id columns
      await this.client.execute({
        sql: `INSERT OR REPLACE INTO ${tableName} (key, value, history_id, agent_id) VALUES (?, ?, ?, ?)`,
        args: [key, serializedValue, historyId, agentId],
      });

      this.debug(`Set agent_history_steps:${key} for history ${historyId} and agent ${agentId}`);
    } catch (error) {
      this.debug(`Error setting agent_history_steps:${key}`, error);
      throw new Error("Failed to set value in agent_history_steps");
    }
  }

  /**
   * Update a history step
   * @param key Step ID
   * @param value Updated step data
   * @param historyId Related history entry ID
   * @param agentId Agent ID for filtering
   */
  async updateHistoryStep(
    key: string,
    value: any,
    historyId: string,
    agentId: string,
  ): Promise<void> {
    // Just call addHistoryStep as the behavior is the same
    return this.addHistoryStep(key, value, historyId, agentId);
  }

  /**
   * Add a timeline event
   * @param key Event ID (UUID)
   * @param value Timeline event data
   * @param historyId Related history entry ID
   * @param agentId Agent ID for filtering
   */
  async addTimelineEvent(
    key: string,
    value: NewTimelineEvent,
    historyId: string,
    agentId: string,
  ): Promise<void> {
    await this.initialized;

    try {
      const tableName = `${this.options.tablePrefix}_agent_history_timeline_events`;

      // Serialize JSON fields
      const inputJSON = value.input ? JSON.stringify(value.input) : null;
      const outputJSON = value.output ? JSON.stringify(value.output) : null;
      const statusMessageJSON = value.statusMessage ? JSON.stringify(value.statusMessage) : null;
      const metadataJSON = value.metadata ? JSON.stringify(value.metadata) : null;
      const tagsJSON = value.tags ? JSON.stringify(value.tags) : null;

      // Insert with all the indexed fields
      await this.client.execute({
        sql: `INSERT OR REPLACE INTO ${tableName} 
              (id, history_id, agent_id, event_type, event_name, 
               start_time, end_time, status, status_message, level, 
               version, parent_event_id, tags,
               input, output, error, metadata) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          key,
          historyId,
          agentId,
          value.type,
          value.name,
          value.startTime,
          value.endTime || null,
          value.status || null,
          statusMessageJSON || null,
          value.level || "INFO",
          value.version || null,
          value.parentEventId || null,
          tagsJSON,
          inputJSON,
          outputJSON,
          statusMessageJSON,
          metadataJSON,
        ],
      });

      this.debug(`Added timeline event ${key} for history ${historyId}`);
    } catch (error) {
      this.debug("Error adding timeline event:", error);
      throw new Error("Failed to add timeline event");
    }
  }

  /**
   * Get a history entry by ID
   * @param key Entry ID
   * @returns The history entry or undefined if not found
   */
  async getHistoryEntry(key: string): Promise<any | undefined> {
    await this.initialized;

    try {
      const tableName = `${this.options.tablePrefix}_agent_history`;

      // Get the entry from the database
      const result = await this.client.execute({
        sql: `SELECT id, agent_id, timestamp, status, input, output, usage, metadata 
				FROM ${tableName} WHERE id = ?`,
        args: [key],
      });

      if (result.rows.length === 0) {
        this.debug(`History entry with ID ${key} not found`);
        return undefined;
      }

      const row = result.rows[0];

      // Construct the entry object
      const entry = {
        id: row.id as string,
        _agentId: row.agent_id as string, // Keep _agentId for compatibility
        timestamp: new Date(row.timestamp as string),
        status: row.status as string,
        input: row.input ? safeJsonParse(row.input as string) : null,
        output: row.output ? safeJsonParse(row.output as string) : null,
        usage: row.usage ? safeJsonParse(row.usage as string) : null,
        metadata: row.metadata ? safeJsonParse(row.metadata as string) : null,
      };

      this.debug(`Got history entry with ID ${key}`);

      // Now also get related steps
      const stepsTableName = `${this.options.tablePrefix}_agent_history_steps`;
      const stepsResult = await this.client.execute({
        sql: `SELECT value FROM ${stepsTableName} WHERE history_id = ? AND agent_id = ?`,
        args: [key, entry._agentId],
      });

      // Parse and transform steps
      const steps = stepsResult.rows.map((row) => {
        const step = safeJsonParse(row.value as string);
        return {
          type: step.type,
          name: step.name,
          content: step.content,
          arguments: step.arguments,
        };
      });

      // Get timeline events
      const timelineEventsTableName = `${this.options.tablePrefix}_agent_history_timeline_events`;
      const timelineEventsResult = await this.client.execute({
        sql: `SELECT id, event_type, event_name, start_time, end_time, 
					status, status_message, level, version, 
					parent_event_id, tags, input, output, error, metadata 
					FROM ${timelineEventsTableName} 
					WHERE history_id = ? AND agent_id = ?`,
        args: [key, entry._agentId],
      });

      // Parse timeline events and construct NewTimelineEvent objects
      const events = timelineEventsResult.rows.map((row) => {
        // Parse JSON fields
        const input = row.input ? safeJsonParse(row.input as string) : undefined;
        const output = row.output ? safeJsonParse(row.output as string) : undefined;
        const error = row.error ? safeJsonParse(row.error as string) : undefined;
        const statusMessage = row.status_message
          ? safeJsonParse(row.status_message as string)
          : undefined;
        const metadata = row.metadata ? safeJsonParse(row.metadata as string) : undefined;
        const tags = row.tags ? safeJsonParse(row.tags as string) : undefined;

        // Construct NewTimelineEvent object
        return {
          id: row.id as string,
          type: row.event_type as string,
          name: row.event_name as string,
          startTime: row.start_time as string,
          endTime: row.end_time as string,
          status: row.status as string,
          statusMessage: statusMessage,
          level: row.level as string,
          version: row.version as string,
          parentEventId: row.parent_event_id as string,
          tags,
          input,
          output,
          error: statusMessage ? statusMessage : error,
          metadata,
        };
      });

      // @ts-ignoreç
      entry.steps = steps;
      // @ts-ignore
      entry.events = events;

      return entry;
    } catch (error) {
      this.debug(`Error getting history entry with ID ${key}`, error);
      return undefined;
    }
  }

  /**
   * Get a history step by ID
   * @param key Step ID
   * @returns The history step or undefined if not found
   */
  async getHistoryStep(key: string): Promise<any | undefined> {
    await this.initialized;

    try {
      const tableName = `${this.options.tablePrefix}_agent_history_steps`;

      // Get the value
      const result = await this.client.execute({
        sql: `SELECT value FROM ${tableName} WHERE key = ?`,
        args: [key],
      });

      if (result.rows.length === 0) {
        this.debug(`History step with ID ${key} not found`);
        return undefined;
      }

      // Parse the JSON value
      const value = safeJsonParse(result.rows[0].value as string);
      this.debug(`Got history step with ID ${key}`);
      return value;
    } catch (error) {
      this.debug(`Error getting history step with ID ${key}`, error);
      return undefined;
    }
  }

  async createConversation(conversation: CreateConversationInput): Promise<Conversation> {
    await this.initialized;

    // Add delay for debugging
    await debugDelay();

    const now = new Date().toISOString();
    const metadataString = JSON.stringify(conversation.metadata);

    const tableName = `${this.options.tablePrefix}_conversations`;

    try {
      await this.client.execute({
        sql: `INSERT INTO ${tableName} (id, resource_id, user_id, title, metadata, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          conversation.id,
          conversation.resourceId,
          conversation.userId,
          conversation.title,
          metadataString,
          now,
          now,
        ],
      });

      return {
        id: conversation.id,
        resourceId: conversation.resourceId,
        userId: conversation.userId,
        title: conversation.title,
        metadata: conversation.metadata,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      this.debug("Error creating conversation:", error);
      throw new Error("Failed to create conversation in LibSQL database");
    }
  }

  async getConversation(id: string): Promise<Conversation | null> {
    await this.initialized;

    // Add delay for debugging
    await debugDelay();

    const tableName = `${this.options.tablePrefix}_conversations`;

    try {
      const result = await this.client.execute({
        sql: `SELECT * FROM ${tableName} WHERE id = ?`,
        args: [id],
      });

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id as string,
        resourceId: row.resource_id as string,
        userId: row.user_id as string,
        title: row.title as string,
        metadata: row.metadata ? safeJsonParse(row.metadata as string) : {},
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      };
    } catch (error) {
      this.debug("Error getting conversation:", error);
      throw new Error("Failed to get conversation from LibSQL database");
    }
  }

  async getConversations(resourceId: string): Promise<Conversation[]> {
    await this.initialized;

    // Add delay for debugging
    await debugDelay();

    const tableName = `${this.options.tablePrefix}_conversations`;

    try {
      const result = await this.client.execute({
        sql: `SELECT * FROM ${tableName} WHERE resource_id = ? ORDER BY updated_at DESC`,
        args: [resourceId],
      });

      return result.rows.map((row) => ({
        id: row.id as string,
        resourceId: row.resource_id as string,
        userId: row.user_id as string,
        title: row.title as string,
        metadata: safeJsonParse(row.metadata as string),
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }));
    } catch (error) {
      this.debug("Error getting conversations:", error);
      throw new Error("Failed to get conversations from LibSQL database");
    }
  }

  public async getConversationsByUserId(
    userId: string,
    options: Omit<ConversationQueryOptions, "userId"> = {},
  ): Promise<Conversation[]> {
    await this.initialized;

    // Add delay for debugging
    await debugDelay();

    const {
      resourceId,
      limit = 50,
      offset = 0,
      orderBy = "updated_at",
      orderDirection = "DESC",
    } = options;

    const tableName = `${this.options.tablePrefix}_conversations`;

    try {
      let sql = `SELECT * FROM ${tableName} WHERE user_id = ?`;
      const args: any[] = [userId];

      if (resourceId) {
        sql += " AND resource_id = ?";
        args.push(resourceId);
      }

      sql += ` ORDER BY ${orderBy} ${orderDirection}`;

      if (limit > 0) {
        sql += " LIMIT ? OFFSET ?";
        args.push(limit, offset);
      }

      const result = await this.client.execute({
        sql,
        args,
      });

      return result.rows.map((row) => ({
        id: row.id as string,
        resourceId: row.resource_id as string,
        userId: row.user_id as string,
        title: row.title as string,
        metadata: safeJsonParse(row.metadata as string),
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }));
    } catch (error) {
      this.debug("Error getting conversations by user ID:", error);
      throw new Error("Failed to get conversations by user ID from LibSQL database");
    }
  }

  /**
   * Query conversations with filtering and pagination options
   *
   * @param options Query options for filtering and pagination
   * @returns Promise that resolves to an array of conversations matching the criteria
   * @see {@link https://voltagent.ai/docs/agents/memory/libsql#querying-conversations | Querying Conversations}
   */
  public async queryConversations(options: ConversationQueryOptions): Promise<Conversation[]> {
    await this.initialized;

    // Add delay for debugging
    await debugDelay();

    const {
      userId,
      resourceId,
      limit = 50,
      offset = 0,
      orderBy = "updated_at",
      orderDirection = "DESC",
    } = options;

    const tableName = `${this.options.tablePrefix}_conversations`;

    try {
      let sql = `SELECT * FROM ${tableName}`;
      const args: any[] = [];
      const conditions: string[] = [];

      if (userId) {
        conditions.push("user_id = ?");
        args.push(userId);
      }

      if (resourceId) {
        conditions.push("resource_id = ?");
        args.push(resourceId);
      }

      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(" AND ")}`;
      }

      sql += ` ORDER BY ${orderBy} ${orderDirection}`;

      if (limit > 0) {
        sql += " LIMIT ? OFFSET ?";
        args.push(limit, offset);
      }

      const result = await this.client.execute({
        sql,
        args,
      });

      return result.rows.map((row) => ({
        id: row.id as string,
        resourceId: row.resource_id as string,
        userId: row.user_id as string,
        title: row.title as string,
        metadata: safeJsonParse(row.metadata as string),
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }));
    } catch (error) {
      this.debug("Error querying conversations:", error);
      throw new Error("Failed to query conversations from LibSQL database");
    }
  }

  /**
   * Get messages for a specific conversation with pagination support
   *
   * @param conversationId The unique identifier of the conversation to retrieve messages from
   * @param options Optional pagination and filtering options
   * @returns Promise that resolves to an array of messages in chronological order (oldest first)
   * @see {@link https://voltagent.ai/docs/agents/memory/libsql#conversation-messages | Getting Conversation Messages}
   */
  public async getConversationMessages(
    conversationId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<MemoryMessage[]> {
    await this.initialized;

    // Add delay for debugging
    await debugDelay();

    const { limit = 100, offset = 0 } = options;
    const tableName = `${this.options.tablePrefix}_messages`;

    try {
      let sql = `SELECT * FROM ${tableName} WHERE conversation_id = ? ORDER BY created_at ASC`;
      const args: any[] = [conversationId];

      if (limit > 0) {
        sql += " LIMIT ? OFFSET ?";
        args.push(limit, offset);
      }

      const result = await this.client.execute({
        sql,
        args,
      });

      return result.rows.map((row) => ({
        id: row.message_id as string,
        role: row.role as BaseMessage["role"],
        content: row.content as string,
        type: row.type as "text" | "tool-call" | "tool-result",
        createdAt: row.created_at as string,
      }));
    } catch (error) {
      this.debug("Error getting conversation messages:", error);
      throw new Error("Failed to get conversation messages from LibSQL database");
    }
  }

  async updateConversation(
    id: string,
    updates: Partial<Omit<Conversation, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Conversation> {
    await this.initialized;

    // Add delay for debugging
    await debugDelay();

    const tableName = `${this.options.tablePrefix}_conversations`;
    const now = new Date().toISOString();

    try {
      const updatesList: string[] = [];
      const args: any[] = [];

      if (updates.resourceId !== undefined) {
        updatesList.push("resource_id = ?");
        args.push(updates.resourceId);
      }

      if (updates.userId !== undefined) {
        updatesList.push("user_id = ?");
        args.push(updates.userId);
      }

      if (updates.title !== undefined) {
        updatesList.push("title = ?");
        args.push(updates.title);
      }

      if (updates.metadata !== undefined) {
        updatesList.push("metadata = ?");
        args.push(JSON.stringify(updates.metadata));
      }

      updatesList.push("updated_at = ?");
      args.push(now);
      args.push(id);

      await this.client.execute({
        sql: `UPDATE ${tableName} SET ${updatesList.join(", ")} WHERE id = ?`,
        args,
      });

      const updated = await this.getConversation(id);
      if (!updated) {
        throw new Error("Conversation not found after update");
      }

      return updated;
    } catch (error) {
      this.debug("Error updating conversation:", error);
      throw new Error("Failed to update conversation in LibSQL database");
    }
  }

  async deleteConversation(id: string): Promise<void> {
    await this.initialized;

    // Add delay for debugging
    await debugDelay();

    const conversationsTableName = `${this.options.tablePrefix}_conversations`;
    const messagesTableName = `${this.options.tablePrefix}_messages`;

    try {
      // Delete all messages in the conversation
      await this.client.execute({
        sql: `DELETE FROM ${messagesTableName} WHERE conversation_id = ?`,
        args: [id],
      });

      // Delete the conversation
      await this.client.execute({
        sql: `DELETE FROM ${conversationsTableName} WHERE id = ?`,
        args: [id],
      });
    } catch (error) {
      this.debug("Error deleting conversation:", error);
      throw new Error("Failed to delete conversation from LibSQL database");
    }
  }

  /**
   * Get all history entries for an agent
   * @param agentId Agent ID
   * @returns Array of all history entries for the agent
   */
  async getAllHistoryEntriesByAgent(agentId: string): Promise<any[]> {
    await this.initialized;

    try {
      const tableName = `${this.options.tablePrefix}_agent_history`;

      // Get all entries for the specified agent ID using the new schema
      const result = await this.client.execute({
        sql: `SELECT id, agent_id, timestamp, status, input, output, usage, metadata 
					FROM ${tableName} WHERE agent_id = ?`,
        args: [agentId],
      });

      // Construct entry objects from rows
      const entries = result.rows.map((row) => ({
        id: row.id as string,
        _agentId: row.agent_id as string, // Keep _agentId for compatibility
        timestamp: new Date(row.timestamp as string),
        status: row.status as string,
        input: row.input ? safeJsonParse(row.input as string) : null,
        output: row.output ? safeJsonParse(row.output as string) : null,
        usage: row.usage ? safeJsonParse(row.usage as string) : null,
        metadata: row.metadata ? safeJsonParse(row.metadata as string) : null,
      }));

      this.debug(`Got all history entries for agent ${agentId} (${entries.length} items)`);

      // Now fetch events and steps for each entry
      const completeEntries = await Promise.all(
        entries.map(async (entry) => {
          // Get steps for this entry
          const stepsTableName = `${this.options.tablePrefix}_agent_history_steps`;
          const stepsResult = await this.client.execute({
            sql: `SELECT value FROM ${stepsTableName} WHERE history_id = ? AND agent_id = ?`,
            args: [entry.id, agentId],
          });

          // Parse and transform steps
          const steps = stepsResult.rows.map((row) => {
            const step = safeJsonParse(row.value as string);
            return {
              type: step.type,
              name: step.name,
              content: step.content,
              arguments: step.arguments,
            };
          });

          // Get timeline events for this entry
          const timelineEventsTableName = `${this.options.tablePrefix}_agent_history_timeline_events`;
          const timelineEventsResult = await this.client.execute({
            sql: `SELECT id, event_type, event_name, start_time, end_time, 
							status, status_message, level, version, 
							parent_event_id, tags, input, output, error, metadata 
							FROM ${timelineEventsTableName} 
							WHERE history_id = ? AND agent_id = ?`,
            args: [entry.id, agentId],
          });

          // Parse timeline events and construct NewTimelineEvent objects
          const events = timelineEventsResult.rows.map((row) => {
            // Parse JSON fields
            const input = row.input ? safeJsonParse(row.input as string) : undefined;
            const output = row.output ? safeJsonParse(row.output as string) : undefined;
            const error = row.error ? safeJsonParse(row.error as string) : undefined;
            const statusMessage = row.status_message
              ? safeJsonParse(row.status_message as string)
              : undefined;
            const metadata = row.metadata ? safeJsonParse(row.metadata as string) : undefined;
            const tags = row.tags ? safeJsonParse(row.tags as string) : undefined;

            // Construct NewTimelineEvent object
            return {
              id: row.id as string,
              type: row.event_type as string,
              name: row.event_name as string,
              startTime: row.start_time as string,
              endTime: row.end_time as string,
              status: row.status as string,
              statusMessage: statusMessage,
              level: row.level as string,
              version: row.version as string,
              parentEventId: row.parent_event_id as string,
              tags,
              input,
              output,
              error: statusMessage ? statusMessage : error,
              metadata,
            };
          });

          // @ts-ignoreç
          entry.steps = steps;
          // @ts-ignore
          entry.events = events;

          return entry;
        }),
      );

      // Return completed entries
      return completeEntries;
    } catch (error) {
      this.debug(`Error getting history entries for agent ${agentId}`, error);
      return [];
    }
  }

  /**
   * Migrates agent history data from old structure to new structure.
   * If migration fails, it can be rolled back using the backup mechanism.
   *
   * Old database structure:
   * CREATE TABLE voltagent_memory_agent_history (
   *   key TEXT PRIMARY KEY,
   *   value TEXT NOT NULL,
   *   agent_id TEXT
   * );
   */
  async migrateAgentHistoryData(
    options: {
      createBackup?: boolean;
      restoreFromBackup?: boolean;
      deleteBackupAfterSuccess?: boolean;
    } = {},
  ): Promise<{
    success: boolean;
    migratedCount?: number;
    error?: Error;
    backupCreated?: boolean;
  }> {
    //await this.initialized;

    const {
      createBackup = true,
      restoreFromBackup = false,
      deleteBackupAfterSuccess = false,
    } = options;

    // Eski tablo ismi
    const oldTableName = `${this.options.tablePrefix}_agent_history`;
    // Eski tablo yedeği
    const oldTableBackup = `${oldTableName}_backup`;
    // Yeni tablo isimleri
    const timelineEventsTableName = `${this.options.tablePrefix}_agent_history_timeline_events`;

    try {
      this.debug("Starting agent history migration...");

      // Check if migration has already been completed by looking for a migration flag
      const flagCheck = await this.checkMigrationFlag("agent_history_data_migration");
      if (flagCheck.alreadyCompleted) {
        return { success: true, migratedCount: 0 };
      }

      // If restoreFromBackup option is active, restore from backup
      if (restoreFromBackup) {
        this.debug("Starting restoration from backup...");

        // Check if backup table exists
        const backupCheck = await this.client.execute({
          sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          args: [oldTableBackup],
        });

        if (backupCheck.rows.length === 0) {
          throw new Error("No backup found to restore");
        }

        // Start transaction
        await this.client.execute("BEGIN TRANSACTION;");

        // Delete current table
        await this.client.execute(`DROP TABLE IF EXISTS ${oldTableName};`);

        // Restore from backup
        await this.client.execute(`ALTER TABLE ${oldTableBackup} RENAME TO ${oldTableName};`);

        // Complete transaction
        await this.client.execute("COMMIT;");

        this.debug("Restoration from backup completed successfully");

        return {
          success: true,
          backupCreated: false,
        };
      }

      // First check the structure of the old table
      const tableInfoQuery = await this.client.execute(`PRAGMA table_info(${oldTableName})`);

      // If the table is empty or doesn't exist, migration is not needed
      if (tableInfoQuery.rows.length === 0) {
        this.debug(`${oldTableName} table not found, migration not needed`);
        return {
          success: true,
          migratedCount: 0,
        };
      }

      // Check if it's an old format table or new format table
      // Old format: key, value, agent_id
      // New format: id, agent_id, timestamp, status, input, output, usage, metadata
      const hasValueColumn = tableInfoQuery.rows.some((row) => row.name === "value");

      if (!hasValueColumn) {
        this.debug("Table is already in new format, migration not needed");
        return {
          success: true,
          migratedCount: 0,
        };
      }

      // Create backup
      if (createBackup) {
        this.debug("Creating backup...");

        // Check previous backup and delete if exists
        const backupCheck = await this.client.execute({
          sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          args: [oldTableBackup],
        });

        if (backupCheck.rows.length > 0) {
          await this.client.execute(`DROP TABLE IF EXISTS ${oldTableBackup};`);
        }

        // Create backup
        await this.client.execute(
          `CREATE TABLE ${oldTableBackup} AS SELECT * FROM ${oldTableName};`,
        );

        this.debug("Backup created successfully");
      }

      // Get all data in old format
      const oldFormatData = await this.client.execute({
        sql: `SELECT key, value, agent_id FROM ${oldTableName}`,
      });

      if (oldFormatData.rows.length === 0) {
        this.debug("No data found to migrate");
        return {
          success: true,
          migratedCount: 0,
          backupCreated: createBackup,
        };
      }

      // Create temporary table
      const tempTableName = `${oldTableName}_temp`;

      await this.client.execute(`
        CREATE TABLE ${tempTableName} (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          status TEXT,
          input TEXT,
          output TEXT,
          usage TEXT,
          metadata TEXT
        )
      `);

      // Start transaction
      await this.client.execute("BEGIN TRANSACTION;");

      let migratedCount = 0;
      const migratedIds = new Set<string>();

      for (const row of oldFormatData.rows) {
        const key = row.key as string;
        const agentId = row.agent_id as string;
        const valueStr = row.value as string;

        try {
          // JSON verisini parse et
          const valueObj = safeJsonParse(valueStr);

          // ID check
          const id = valueObj.id || key;

          // Skip if this ID has already been migrated
          if (migratedIds.has(id)) {
            continue;
          }

          migratedIds.add(id);
          migratedCount++;

          // Add main history record
          const inputJSON = valueObj.input ? JSON.stringify(valueObj.input) : null;
          const outputJSON = valueObj.output ? JSON.stringify(valueObj.output) : null;
          const usageJSON = valueObj.usage ? JSON.stringify(valueObj.usage) : null;

          await this.client.execute({
            sql: `INSERT INTO ${tempTableName} 
                    (id, agent_id, timestamp, status, input, output, usage, metadata) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              id,
              valueObj._agentId || agentId,
              valueObj.timestamp || new Date().toISOString(),
              valueObj.status || null,
              inputJSON,
              outputJSON,
              usageJSON,
              null,
            ],
          });
          let input = "";

          // Transfer events to timeline_events table
          if (Array.isArray(valueObj.events)) {
            for (const event of valueObj.events) {
              try {
                // Skip events with affectedNodeId starting with message_
                // @ts-ignore
                if (event.affectedNodeId?.startsWith("message_")) {
                  input = event.data.input;
                  continue;
                }

                // Convert to new timeline event format
                const eventId = event.id || this.generateId();
                const eventType = event.type || "unknown";
                let eventName = event.name || "unknown";
                const startTime = event.timestamp || event.startTime || new Date().toISOString();
                const endTime = event.updatedAt || event.endTime || startTime;
                let status = event.status || event.data?.status || null;
                let inputData = null;

                // Set input data correctly
                if (event.input) {
                  inputData = JSON.stringify({ input: event.input });
                } else if (event.data?.input) {
                  inputData = JSON.stringify({ input: event.data.input });
                } else if (input) {
                  inputData = JSON.stringify({ input: input });
                }

                input = "";

                // Set metadata
                let metadata = null;
                if (event.metadata) {
                  metadata = JSON.stringify(event.metadata);
                } else if (event.data) {
                  metadata = JSON.stringify({
                    id: event.affectedNodeId?.split("_").pop(),
                    agentId: event.data?.metadata?.sourceAgentId,
                    ...event.data,
                  });
                }

                // Special event transformations
                if (eventType === "agent") {
                  if (eventName === "start") {
                    eventName = "agent:start";
                    // @ts-ignore
                    status = "running";
                  } else if (eventName === "finished") {
                    if (event.data.status === "error") {
                      eventName = "agent:error";
                    } else {
                      eventName = "agent:success";
                    }
                  }

                  // Add to timeline events table
                  await this.client.execute({
                    sql: `INSERT OR REPLACE INTO ${timelineEventsTableName}
                          (id, history_id, agent_id, event_type, event_name, start_time, end_time, 
                          status, status_message, level, version, parent_event_id, 
                          tags, input, output, error, metadata)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                      eventId,
                      id,
                      valueObj._agentId || agentId,
                      eventType,
                      eventName,
                      startTime,
                      endTime,
                      // @ts-ignore
                      status,
                      eventName === "agent:error" ? event.data.error.message : null,
                      event.level || "INFO",
                      event.version || null,
                      event.parentEventId || null,
                      null, // tags
                      inputData,
                      event.data.output ? JSON.stringify(event.data.output) : null,
                      eventName === "agent:error" ? JSON.stringify(event.data.error) : null,
                      metadata,
                    ],
                  });
                } else if (eventType === "memory") {
                  // memory:saveMessage -> memory:write_start and memory:write_success
                  if (eventName === "memory:saveMessage") {
                    // First event: memory:write_start
                    await this.client.execute({
                      sql: `INSERT OR REPLACE INTO ${timelineEventsTableName}
                            (id, history_id, agent_id, event_type, event_name, start_time, end_time, 
                            status, status_message, level, version, parent_event_id, 
                            tags, input, output, error, metadata)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      args: [
                        eventId,
                        id,
                        valueObj._agentId || agentId,
                        eventType,
                        "memory:write_start",
                        startTime,
                        null, // no endTime
                        "running",
                        event.statusMessage || null,
                        event.level || "INFO",
                        event.version || null,
                        event.parentEventId || null,
                        null, // tags
                        inputData,
                        null, // no output
                        null, // no error
                        JSON.stringify({
                          id: "memory",
                          agentId: event.affectedNodeId?.split("_").pop(),
                        }),
                      ],
                    });

                    // Second event: tool:success
                    await this.client.execute({
                      sql: `INSERT OR REPLACE INTO ${timelineEventsTableName}
                            (id, history_id, agent_id, event_type, event_name, start_time, end_time, 
                            status, status_message, level, version, parent_event_id, 
                            tags, input, output, error, metadata)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      args: [
                        this.generateId(), // New ID
                        id,
                        valueObj._agentId || agentId,
                        eventType,
                        "memory:write_success",
                        endTime, // End time
                        endTime,
                        "completed",
                        event.statusMessage || null,
                        event.level || "INFO",
                        event.version || null,
                        eventId, // Parent event ID
                        null, // tags
                        inputData,
                        event.data.output ? JSON.stringify(event.data.output) : null,
                        event.error ? JSON.stringify(event.error) : null,
                        JSON.stringify({
                          id: "memory",
                          agentId: event.affectedNodeId?.split("_").pop(),
                        }),
                      ],
                    });
                  }
                  // memory:getMessages -> memory:read_start and memory:read_success
                  else if (eventName === "memory:getMessages") {
                    // First event: memory:read_start
                    await this.client.execute({
                      sql: `INSERT OR REPLACE INTO ${timelineEventsTableName}
                            (id, history_id, agent_id, event_type, event_name, start_time, end_time, 
                            status, status_message, level, version, parent_event_id, 
                            tags, input, output, error, metadata)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      args: [
                        eventId,
                        id,
                        valueObj._agentId || agentId,
                        eventType,
                        "memory:read_start",
                        startTime,
                        null, // no endTime
                        "running",
                        event.statusMessage || null,
                        event.level || "INFO",
                        event.version || null,
                        event.parentEventId || null,
                        null, // tags
                        inputData,
                        null, // no output
                        null, // no error
                        JSON.stringify({
                          id: "memory",
                          agentId: event.affectedNodeId?.split("_").pop(),
                        }),
                      ],
                    });

                    // Second event: memory:read_success
                    await this.client.execute({
                      sql: `INSERT OR REPLACE INTO ${timelineEventsTableName}
                            (id, history_id, agent_id, event_type, event_name, start_time, end_time, 
                            status, status_message, level, version, parent_event_id, 
                            tags, input, output, error, metadata)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      args: [
                        this.generateId(), // New ID
                        id,
                        valueObj._agentId || agentId,
                        eventType,
                        "memory:read_success",
                        endTime, // End time
                        endTime,
                        status,
                        event.statusMessage || null,
                        event.level || "INFO",
                        event.version || null,
                        eventId, // Parent event ID
                        null, // tags
                        inputData,
                        event.data.output ? JSON.stringify(event.data.output) : null,
                        event.error ? JSON.stringify(event.error) : null,
                        JSON.stringify({
                          id: "memory",
                          agentId: event.affectedNodeId?.split("_").pop(),
                        }),
                      ],
                    });
                  } else {
                    // Normal addition for other memory events
                    await this.client.execute({
                      sql: `INSERT OR REPLACE INTO ${timelineEventsTableName}
                            (id, history_id, agent_id, event_type, event_name, start_time, end_time, 
                            status, status_message, level, version, parent_event_id, 
                            tags, input, output, error, metadata)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      args: [
                        eventId,
                        id,
                        valueObj._agentId || agentId,
                        eventType,
                        eventName,
                        startTime,
                        endTime,
                        status,
                        event.statusMessage || null,
                        event.level || "INFO",
                        event.version || null,
                        event.parentEventId || null,
                        null, // tags
                        inputData,
                        event.output ? JSON.stringify(event.output) : null,
                        event.error ? JSON.stringify(event.error) : null,
                        metadata,
                      ],
                    });
                  }
                } else if (eventType === "tool") {
                  if (eventName === "tool_working") {
                    // First event: tool:start
                    await this.client.execute({
                      sql: `INSERT OR REPLACE INTO ${timelineEventsTableName}
								(id, history_id, agent_id, event_type, event_name, start_time, end_time, 
								status, status_message, level, version, parent_event_id, 
								tags, input, output, error, metadata)
								VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      args: [
                        eventId,
                        id,
                        valueObj._agentId || agentId,
                        eventType,
                        "tool:start",
                        startTime,
                        null, // no endTime
                        "running",
                        event.statusMessage || null,
                        event.level || "INFO",
                        event.version || null,
                        event.parentEventId || null,
                        null, // tags
                        inputData,
                        null, // no output
                        null, // no error
                        JSON.stringify({
                          id: event.affectedNodeId?.split("_").pop(),
                          agentId: event.data?.metadata?.sourceAgentId,
                          displayName: event.data.metadata.toolName,
                        }),
                      ],
                    });

                    // Second event: tool:success
                    await this.client.execute({
                      sql: `INSERT OR REPLACE INTO ${timelineEventsTableName}
								(id, history_id, agent_id, event_type, event_name, start_time, end_time, 
								status, status_message, level, version, parent_event_id, 
								tags, input, output, error, metadata)
								VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      args: [
                        this.generateId(), // New ID
                        id,
                        valueObj._agentId || agentId,
                        eventType,
                        "tool:success",
                        endTime, // End time
                        endTime,
                        "completed",
                        event.statusMessage || null,
                        event.level || "INFO",
                        event.version || null,
                        eventId, // Parent event ID
                        null, // tags
                        inputData,
                        event.data.output ? JSON.stringify(event.data.output) : null,
                        event.error ? JSON.stringify(event.error) : null,
                        JSON.stringify({
                          id: event.affectedNodeId?.split("_").pop(),
                          agentId: event.data?.metadata?.sourceAgentId,
                          displayName: event.data.metadata.toolName,
                        }),
                      ],
                    });
                  }
                } else {
                  // Normal addition for other event types
                  await this.client.execute({
                    sql: `INSERT OR REPLACE INTO ${timelineEventsTableName}
                          (id, history_id, agent_id, event_type, event_name, start_time, end_time, 
                          status, status_message, level, version, parent_event_id, 
                          tags, input, output, error, metadata)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                      eventId,
                      id,
                      valueObj._agentId || agentId,
                      eventType,
                      eventName,
                      startTime,
                      endTime,
                      status,
                      event.statusMessage || null,
                      event.level || "INFO",
                      event.version || null,
                      event.parentEventId || null,
                      null, // tags
                      inputData,
                      event.output ? JSON.stringify(event.output) : null,
                      event.error ? JSON.stringify(event.error) : null,
                      JSON.stringify({
                        id: eventType === "retriever" ? "retriever" : event.type,
                        agentId: event.affectedNodeId?.split("_").pop(),
                      }),
                    ],
                  });
                }
              } catch (error) {
                this.debug("Error processing event:", error);
                // Skip problematic event but continue migration
              }
            }
          }

          // Note: steps field is removed so it won't be processed here
        } catch (error) {
          this.debug(`Error processing record with ID ${key}:`, error);
          // Skip problematic records and continue
        }
      }

      // Delete original table and rename temp table as original table
      await this.client.execute(`DROP TABLE ${oldTableName};`);
      await this.client.execute(`ALTER TABLE ${tempTableName} RENAME TO ${oldTableName};`);

      // Recreate indexes
      await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${oldTableName}_agent_id 
        ON ${oldTableName}(agent_id)
      `);

      // Complete transaction
      await this.client.execute("COMMIT;");

      this.debug(`Total ${migratedCount} records successfully migrated`);

      // Should we delete the backup after success?
      if (createBackup && deleteBackupAfterSuccess) {
        await this.client.execute(`DROP TABLE IF EXISTS ${oldTableBackup};`);
        this.debug("Unnecessary backup deleted");
      }

      // Set migration flag to prevent future runs
      await this.setMigrationFlag("agent_history_data_migration", migratedCount);

      return {
        success: true,
        migratedCount,
        backupCreated: createBackup && !deleteBackupAfterSuccess,
      };
    } catch (error) {
      // Rollback in case of error
      await this.client.execute("ROLLBACK;");

      this.debug("Error occurred while migrating agent history data:", error);

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        backupCreated: options.createBackup,
      };
    }
  }

  /**
   * Migrate conversation schema to add user_id and update messages table
   *
   * ⚠️  **CRITICAL WARNING: DESTRUCTIVE OPERATION** ⚠️
   *
   * This method performs a DESTRUCTIVE schema migration that:
   * - DROPS and recreates existing tables
   * - Creates temporary tables during migration
   * - Modifies the primary key structure of the messages table
   * - Can cause DATA LOSS if interrupted or if errors occur
   *
   * **IMPORTANT SAFETY REQUIREMENTS:**
   * - 🛑 STOP all application instances before running this migration
   * - 🛑 Ensure NO concurrent database operations are running
   * - 🛑 Take a full database backup before running (independent of built-in backup)
   * - 🛑 Test the migration on a copy of production data first
   * - 🛑 Plan for downtime during migration execution
   *
   * **What this migration does:**
   * 1. Creates backup tables (if createBackup=true)
   * 2. Creates temporary tables with new schema
   * 3. Migrates data from old tables to new schema
   * 4. DROPS original tables
   * 5. Renames temporary tables to original names
   * 6. All operations are wrapped in a transaction for atomicity
   *
   * @param options Migration configuration options
   * @param options.createBackup Whether to create backup tables before migration (default: true, HIGHLY RECOMMENDED)
   * @param options.restoreFromBackup Whether to restore from existing backup instead of migrating (default: false)
   * @param options.deleteBackupAfterSuccess Whether to delete backup tables after successful migration (default: false)
   *
   * @returns Promise resolving to migration result with success status, migrated count, and backup info
   *
   * @example
   * ```typescript
   * // RECOMMENDED: Run with backup creation (default)
   * const result = await storage.migrateConversationSchema({
   *   createBackup: true,
   *   deleteBackupAfterSuccess: false // Keep backup for safety
   * });
   *
   * if (result.success) {
   *   console.log(`Migrated ${result.migratedCount} conversations successfully`);
   * } else {
   *   console.error('Migration failed:', result.error);
   *   // Consider restoring from backup
   * }
   *
   * // If migration fails, restore from backup:
   * const restoreResult = await storage.migrateConversationSchema({
   *   restoreFromBackup: true
   * });
   * ```
   *
   * @throws {Error} If migration fails and transaction is rolled back
   *
   * @since This migration is typically only needed when upgrading from older schema versions
   */
  private async migrateConversationSchema(
    options: {
      createBackup?: boolean;
      restoreFromBackup?: boolean;
      deleteBackupAfterSuccess?: boolean;
    } = {},
  ): Promise<{
    success: boolean;
    migratedCount?: number;
    error?: Error;
    backupCreated?: boolean;
  }> {
    const {
      createBackup = true,
      restoreFromBackup = false,
      deleteBackupAfterSuccess = false,
    } = options;

    const conversationsTableName = `${this.options.tablePrefix}_conversations`;
    const messagesTableName = `${this.options.tablePrefix}_messages`;
    const conversationsBackupName = `${conversationsTableName}_backup`;
    const messagesBackupName = `${messagesTableName}_backup`;

    try {
      this.debug("Starting conversation schema migration...");

      // Check if migration has already been completed by looking for a migration flag
      const flagCheck = await this.checkMigrationFlag("conversation_schema_migration");
      if (flagCheck.alreadyCompleted) {
        return { success: true, migratedCount: 0 };
      }

      // If restoreFromBackup option is active, restore from backup
      if (restoreFromBackup) {
        this.debug("Starting restoration from backup...");

        // Check if backup tables exist
        const convBackupCheck = await this.client.execute({
          sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          args: [conversationsBackupName],
        });

        const msgBackupCheck = await this.client.execute({
          sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          args: [messagesBackupName],
        });

        if (convBackupCheck.rows.length === 0 || msgBackupCheck.rows.length === 0) {
          throw new Error("No backup found to restore");
        }

        // Start transaction
        await this.client.execute("BEGIN TRANSACTION;");

        // Restore tables from backup
        await this.client.execute(`DROP TABLE IF EXISTS ${conversationsTableName};`);
        await this.client.execute(`DROP TABLE IF EXISTS ${messagesTableName};`);
        await this.client.execute(
          `ALTER TABLE ${conversationsBackupName} RENAME TO ${conversationsTableName};`,
        );
        await this.client.execute(
          `ALTER TABLE ${messagesBackupName} RENAME TO ${messagesTableName};`,
        );

        // Complete transaction
        await this.client.execute("COMMIT;");

        this.debug("Restoration from backup completed successfully");
        return { success: true, backupCreated: false };
      }

      // Check current table structures
      const convTableInfo = await this.client.execute(
        `PRAGMA table_info(${conversationsTableName})`,
      );

      const msgTableInfo = await this.client.execute(`PRAGMA table_info(${messagesTableName})`);

      // Check if conversations table has user_id column
      const hasUserIdInConversations = convTableInfo.rows.some((row) => row.name === "user_id");

      // Check if messages table has user_id column
      const hasUserIdInMessages = msgTableInfo.rows.some((row) => row.name === "user_id");

      // If conversations already has user_id and messages doesn't have user_id, migration not needed
      if (hasUserIdInConversations && !hasUserIdInMessages) {
        this.debug("Tables are already in new format, migration not needed");
        return { success: true, migratedCount: 0 };
      }

      // If neither table exists, no migration needed
      if (convTableInfo.rows.length === 0 && msgTableInfo.rows.length === 0) {
        this.debug("Tables don't exist, migration not needed");
        return { success: true, migratedCount: 0 };
      }

      // Create backups if requested
      if (createBackup) {
        this.debug("Creating backups...");

        // Remove existing backups
        await this.client.execute(`DROP TABLE IF EXISTS ${conversationsBackupName};`);
        await this.client.execute(`DROP TABLE IF EXISTS ${messagesBackupName};`);

        // Create backups
        if (convTableInfo.rows.length > 0) {
          await this.client.execute(
            `CREATE TABLE ${conversationsBackupName} AS SELECT * FROM ${conversationsTableName};`,
          );
        }

        if (msgTableInfo.rows.length > 0) {
          await this.client.execute(
            `CREATE TABLE ${messagesBackupName} AS SELECT * FROM ${messagesTableName};`,
          );
        }

        this.debug("Backups created successfully");
      }

      // Get existing data
      let conversationData: Row[] = [];
      let messageData: Row[] = [];

      if (convTableInfo.rows.length > 0) {
        const convResult = await this.client.execute(`SELECT * FROM ${conversationsTableName}`);
        conversationData = convResult.rows;
      }

      if (msgTableInfo.rows.length > 0) {
        const msgResult = await this.client.execute(`SELECT * FROM ${messagesTableName}`);
        messageData = msgResult.rows;
      }

      // Start transaction for migration
      await this.client.execute("BEGIN TRANSACTION;");

      // Create temporary tables with new schemas
      const tempConversationsTable = `${conversationsTableName}_temp`;
      const tempMessagesTable = `${messagesTableName}_temp`;

      await this.client.execute(`
        CREATE TABLE ${tempConversationsTable} (
          id TEXT PRIMARY KEY,
          resource_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          metadata TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await this.client.execute(`
        CREATE TABLE ${tempMessagesTable} (
          conversation_id TEXT NOT NULL,
          message_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          type TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (conversation_id, message_id)
        )
      `);

      let migratedCount = 0;
      const createdConversations = new Set<string>();

      // Process each message and create conversation if needed
      for (const row of messageData) {
        const conversationId = row.conversation_id as string;
        let userId = "default";

        // Get user_id from message if old schema has it
        if (hasUserIdInMessages && row.user_id) {
          userId = row.user_id as string;
        }

        // Check if conversation already exists (either migrated or auto-created)
        if (!createdConversations.has(conversationId)) {
          // Check if conversation exists in original conversations data
          const existingConversation = conversationData.find((conv) => conv.id === conversationId);

          if (existingConversation) {
            // Migrate existing conversation
            let convUserId = userId; // Use user_id from message

            // If conversation already has user_id, use it instead
            if (hasUserIdInConversations && existingConversation.user_id) {
              convUserId = existingConversation.user_id as string;
            }

            await this.client.execute({
              sql: `INSERT INTO ${tempConversationsTable} 
                    (id, resource_id, user_id, title, metadata, created_at, updated_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
              args: [
                existingConversation.id,
                existingConversation.resource_id,
                convUserId,
                existingConversation.title,
                existingConversation.metadata,
                existingConversation.created_at,
                existingConversation.updated_at,
              ],
            });
          } else {
            // Create new conversation from message data
            const now = new Date().toISOString();

            await this.client.execute({
              sql: `INSERT INTO ${tempConversationsTable} 
                    (id, resource_id, user_id, title, metadata, created_at, updated_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
              args: [
                conversationId,
                "default", // Default resource_id for auto-created conversations
                userId,
                "Migrated Conversation", // Default title
                JSON.stringify({}), // Empty metadata
                now,
                now,
              ],
            });
          }

          createdConversations.add(conversationId);
          migratedCount++;
        }

        // Migrate the message (without user_id column)
        await this.client.execute({
          sql: `INSERT INTO ${tempMessagesTable} 
                (conversation_id, message_id, role, content, type, created_at) 
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            row.conversation_id,
            row.message_id,
            row.role,
            row.content,
            row.type,
            row.created_at,
          ],
        });
      }

      // Handle any conversations that exist but have no messages
      for (const row of conversationData) {
        const conversationId = row.id as string;

        if (!createdConversations.has(conversationId)) {
          let userId = "default";

          // If conversation already has user_id, use it
          if (hasUserIdInConversations && row.user_id) {
            userId = row.user_id as string;
          }

          await this.client.execute({
            sql: `INSERT INTO ${tempConversationsTable} 
                  (id, resource_id, user_id, title, metadata, created_at, updated_at) 
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [
              row.id,
              row.resource_id,
              userId,
              row.title,
              row.metadata,
              row.created_at,
              row.updated_at,
            ],
          });
          migratedCount++;
        }
      }

      // Replace old tables with new ones
      await this.client.execute(`DROP TABLE IF EXISTS ${conversationsTableName};`);
      await this.client.execute(`DROP TABLE IF EXISTS ${messagesTableName};`);
      await this.client.execute(
        `ALTER TABLE ${tempConversationsTable} RENAME TO ${conversationsTableName};`,
      );
      await this.client.execute(`ALTER TABLE ${tempMessagesTable} RENAME TO ${messagesTableName};`);

      // Create indexes for the new schema
      await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${messagesTableName}_lookup
        ON ${messagesTableName}(conversation_id, created_at)
      `);

      await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${conversationsTableName}_resource
        ON ${conversationsTableName}(resource_id)
      `);

      await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${conversationsTableName}_user
        ON ${conversationsTableName}(user_id)
      `);

      // Commit transaction
      await this.client.execute("COMMIT;");

      // Delete backups if requested
      if (deleteBackupAfterSuccess) {
        await this.client.execute(`DROP TABLE IF EXISTS ${conversationsBackupName};`);
        await this.client.execute(`DROP TABLE IF EXISTS ${messagesBackupName};`);
      }

      // Set migration flag to prevent future runs
      await this.setMigrationFlag("conversation_schema_migration", migratedCount);

      this.debug(
        `Conversation schema migration completed successfully. Migrated ${migratedCount} conversations.`,
      );

      return {
        success: true,
        migratedCount,
        backupCreated: createBackup,
      };
    } catch (error) {
      this.debug("Error during conversation schema migration:", error);

      // Rollback transaction if still active
      try {
        await this.client.execute("ROLLBACK;");
      } catch (rollbackError) {
        this.debug("Error rolling back transaction:", rollbackError);
      }

      return {
        success: false,
        error: error as Error,
        backupCreated: createBackup,
      };
    }
  }

  /**
   * Get conversations for a user with a fluent query builder interface
   * @param userId User ID to filter by
   * @returns Query builder object
   */
  public getUserConversations(userId: string) {
    return {
      /**
       * Limit the number of results
       * @param count Number of conversations to return
       * @returns Query builder
       */
      limit: (count: number) => ({
        /**
         * Order results by a specific field
         * @param field Field to order by
         * @param direction Sort direction
         * @returns Query builder
         */
        orderBy: (
          field: "created_at" | "updated_at" | "title" = "updated_at",
          direction: "ASC" | "DESC" = "DESC",
        ) => ({
          /**
           * Execute the query and return results
           * @returns Promise of conversations
           */
          execute: () =>
            this.getConversationsByUserId(userId, {
              limit: count,
              orderBy: field,
              orderDirection: direction,
            }),
        }),
        /**
         * Execute the query with default ordering
         * @returns Promise of conversations
         */
        execute: () => this.getConversationsByUserId(userId, { limit: count }),
      }),

      /**
       * Order results by a specific field
       * @param field Field to order by
       * @param direction Sort direction
       * @returns Query builder
       */
      orderBy: (
        field: "created_at" | "updated_at" | "title" = "updated_at",
        direction: "ASC" | "DESC" = "DESC",
      ) => ({
        /**
         * Limit the number of results
         * @param count Number of conversations to return
         * @returns Query builder
         */
        limit: (count: number) => ({
          /**
           * Execute the query and return results
           * @returns Promise of conversations
           */
          execute: () =>
            this.getConversationsByUserId(userId, {
              limit: count,
              orderBy: field,
              orderDirection: direction,
            }),
        }),
        /**
         * Execute the query without limit
         * @returns Promise of conversations
         */
        execute: () =>
          this.getConversationsByUserId(userId, {
            orderBy: field,
            orderDirection: direction,
          }),
      }),

      /**
       * Execute the query with default options
       * @returns Promise of conversations
       */
      execute: () => this.getConversationsByUserId(userId),
    };
  }

  /**
   * Get conversation by ID and ensure it belongs to the specified user
   * @param conversationId Conversation ID
   * @param userId User ID to validate ownership
   * @returns Conversation or null
   */
  public async getUserConversation(
    conversationId: string,
    userId: string,
  ): Promise<Conversation | null> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return null;
    }
    return conversation;
  }

  /**
   * Get paginated conversations for a user
   * @param userId User ID
   * @param page Page number (1-based)
   * @param pageSize Number of items per page
   * @returns Object with conversations and pagination info
   */
  public async getPaginatedUserConversations(
    userId: string,
    page = 1,
    pageSize = 10,
  ): Promise<{
    conversations: Conversation[];
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
    const offset = (page - 1) * pageSize;

    // Get one extra to check if there are more pages
    const conversations = await this.getConversationsByUserId(userId, {
      limit: pageSize + 1,
      offset,
      orderBy: "updated_at",
      orderDirection: "DESC",
    });

    const hasMore = conversations.length > pageSize;
    const results = hasMore ? conversations.slice(0, pageSize) : conversations;

    return {
      conversations: results,
      page,
      pageSize,
      hasMore,
    };
  }

  /**
   * Check and create migration flag table, return if migration already completed
   * @param migrationType Type of migration to check
   * @returns Object with completion status and details
   */
  private async checkMigrationFlag(migrationType: string): Promise<{
    alreadyCompleted: boolean;
    migrationCount?: number;
    completedAt?: string;
  }> {
    const conversationsTableName = `${this.options.tablePrefix}_conversations`;
    const migrationFlagTable = `${conversationsTableName}_migration_flags`;

    try {
      const result = await this.client.execute({
        sql: `SELECT * FROM ${migrationFlagTable} WHERE migration_type = ?`,
        args: [migrationType],
      });

      if (result.rows.length > 0) {
        const migrationFlag = result.rows[0];
        this.debug(`${migrationType} migration already completed`);
        this.debug(`Migration completed on: ${migrationFlag.completed_at}`);
        this.debug(`Migrated ${migrationFlag.migrated_count || 0} records previously`);
        return {
          alreadyCompleted: true,
          migrationCount: migrationFlag.migrated_count as number,
          completedAt: migrationFlag.completed_at as string,
        };
      }

      this.debug("Migration flags table found, but no migration flag exists yet");
      return { alreadyCompleted: false };
    } catch (flagError) {
      // Migration flag table doesn't exist, create it
      this.debug("Migration flag table not found, creating it...");
      this.debug("Original error:", flagError);

      try {
        await this.client.execute(`
          CREATE TABLE IF NOT EXISTS ${migrationFlagTable} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            migration_type TEXT NOT NULL UNIQUE,
            completed_at TEXT NOT NULL DEFAULT (datetime('now')),
            migrated_count INTEGER DEFAULT 0,
            metadata TEXT DEFAULT '{}'
          )
        `);
        this.debug("Migration flags table created successfully");
      } catch (createError) {
        this.debug("Failed to create migration flags table:", createError);
        // Continue with migration even if flag table creation fails
      }

      return { alreadyCompleted: false };
    }
  }

  /**
   * Set migration flag after successful completion
   * @param migrationType Type of migration completed
   * @param migratedCount Number of records migrated
   */
  private async setMigrationFlag(migrationType: string, migratedCount: number): Promise<void> {
    try {
      const conversationsTableName = `${this.options.tablePrefix}_conversations`;
      const migrationFlagTable = `${conversationsTableName}_migration_flags`;

      await this.client.execute({
        sql: `INSERT OR REPLACE INTO ${migrationFlagTable} 
              (migration_type, completed_at, migrated_count) 
              VALUES (?, datetime('now'), ?)`,
        args: [migrationType, migratedCount],
      });

      this.debug("Migration flag set successfully");
    } catch (flagSetError) {
      this.debug("Could not set migration flag (non-critical):", flagSetError);
    }
  }
}
