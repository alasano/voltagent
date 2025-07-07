---
title: PostgreSQL Memory
slug: /agents/memory/postgres
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# PostgreSQL Memory

The `@voltagent/postgres` package provides a `PostgresStorage` provider that uses PostgreSQL for persistent storage of agent memory.

This is ideal for production applications requiring enterprise-grade database storage, complex queries, or integration with existing PostgreSQL infrastructure.

## Setup

### Install Package

First, install the necessary packages:

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>

```bash
npm install @voltagent/postgres
```

  </TabItem>
  <TabItem value="yarn" label="yarn">

```bash
yarn add @voltagent/postgres
```

  </TabItem>
  <TabItem value="pnpm" label="pnpm">

```bash
pnpm add @voltagent/postgres
```

  </TabItem>
</Tabs>

### Database Requirements

You need a PostgreSQL server (version 12 or higher recommended). The provider **automatically creates** all necessary tables and indexes when initialized, so no manual SQL setup is required.

### Credentials

You'll need your PostgreSQL connection details:

- **Host:** Your PostgreSQL server hostname
- **Port:** Usually 5432
- **Database:** Database name
- **User:** Database username
- **Password:** Database password

Store these credentials securely, typically as environment variables or use a connection string format.

## Configuration

Import `PostgresStorage` and initialize it with your credentials:

```typescript
import { Agent } from "@voltagent/core";
import { PostgresStorage } from "@voltagent/postgres";
import { VercelAIProvider } from "@voltagent/vercel-ai";
import { openai } from "@ai-sdk/openai";

// Using connection string (recommended)
const memory = new PostgresStorage({
  connection: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/mydb",
  // Optional: Adjust connection pool size
  maxConnections: 10,
  // Optional: Specify a custom base table name prefix
  tablePrefix: "voltagent_memory", // Defaults to 'voltagent_memory'
  // Optional: Storage limit (max number of messages per user/conversation)
  storageLimit: 100, // Defaults to 100
});

// Alternative: Using connection object
const memory = new PostgresStorage({
  connection: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME || "mydb",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === "production", // Enable SSL for production
  },
  maxConnections: 10,
  tablePrefix: "voltagent_memory",
  storageLimit: 100,
});

const agent = new Agent({
  name: "PostgreSQL Memory Agent",
  instructions: "An agent using PostgreSQL for memory.",
  llm: new VercelAIProvider(),
  model: openai("gpt-4o"),
  memory: memory, // Assign the memory provider instance
});
```

**Configuration Options:**

- `connection` (string or object, required): Database connection details.
  - **Connection string:** `"postgresql://user:password@host:port/database"`
  - **Connection object:** `{ host, port, database, user, password, ssl }`
- `maxConnections` (number, optional): Maximum connections in the pool. Defaults to `10`.
- `tablePrefix` (string, optional): Prefix for database table names. Defaults to `voltagent_memory`.
- `storageLimit` (number, optional): Maximum messages to retain per conversation. Defaults to `100`.
- `debug` (boolean, optional): Enable debug logging. Defaults to `false`.

## Conversation Management

### Get User's Conversations

```typescript
// Get recent conversations for a user
const conversations = await storage.getConversationsByUserId("user-123", {
  limit: 50,
  orderBy: "updated_at",
  orderDirection: "DESC",
});

// Display in sidebar like ChatGPT
conversations.forEach((conv) => {
  console.log(`${conv.title} - ${conv.updatedAt}`);
});
```

### Advanced Query Builder

```typescript
// Fluent query interface
const recentChats = await storage
  .getUserConversations("user-123")
  .limit(20)
  .orderBy("updated_at", "DESC")
  .execute();

// Get paginated conversations
const page1 = await storage.getPaginatedUserConversations("user-123", 1, 10);
console.log(`Page 1 of ${page1.hasMore ? "many" : page1.conversations.length}`);
```

## Querying Conversations

The PostgreSQL storage provides powerful conversation querying capabilities with filtering, pagination, and sorting options:

```typescript
// Query with multiple filters
const workConversations = await storage.queryConversations({
  userId: "user-123",
  resourceId: "work-agent",
  limit: 25,
  offset: 0,
  orderBy: "created_at",
  orderDirection: "DESC",
});

// Get all conversations for a user
const userConversations = await storage.queryConversations({
  userId: "user-123",
  limit: 50,
});

// Get conversations for a specific resource
const resourceConversations = await storage.queryConversations({
  resourceId: "chatbot-v1",
  limit: 100,
  orderBy: "updated_at",
});

// Admin view - get all conversations
const allConversations = await storage.queryConversations({
  limit: 200,
  orderBy: "created_at",
  orderDirection: "ASC",
});
```

**Query Options:**

- `userId` (optional): Filter conversations by specific user
- `resourceId` (optional): Filter conversations by specific resource
- `limit` (optional): Maximum number of conversations to return (default: 50)
- `offset` (optional): Number of conversations to skip for pagination (default: 0)
- `orderBy` (optional): Field to sort by: 'created_at', 'updated_at', or 'title' (default: 'updated_at')
- `orderDirection` (optional): Sort direction: 'ASC' or 'DESC' (default: 'DESC')

## Getting Conversation Messages

Retrieve messages for a specific conversation with pagination support:

```typescript
// Get all messages for a conversation
const messages = await storage.getConversationMessages("conversation-456");

// Get messages with pagination
const firstBatch = await storage.getConversationMessages("conversation-456", {
  limit: 50,
  offset: 0,
});

// Get next batch
const nextBatch = await storage.getConversationMessages("conversation-456", {
  limit: 50,
  offset: 50,
});

// Process messages in batches for large conversations
const batchSize = 100;
let offset = 0;
let hasMore = true;

while (hasMore) {
  const batch = await storage.getConversationMessages("conversation-456", {
    limit: batchSize,
    offset: offset,
  });

  // Process batch
  processBatch(batch);

  hasMore = batch.length === batchSize;
  offset += batchSize;
}
```

**Message Query Options:**

- `limit` (optional): Maximum number of messages to return (default: 100)
- `offset` (optional): Number of messages to skip for pagination (default: 0)

Messages are returned in chronological order (oldest first) for natural conversation flow.

## Automatic Table Creation

Unlike manual database setup, `PostgresStorage` **automatically creates** the necessary tables (`messages`, `conversations`, `agent_history`, `agent_history_steps`, `agent_history_timeline_events`, with the configured `tablePrefix`) and indexes in your PostgreSQL database if they don't already exist. This simplifies setup for both development and production.

## Production Considerations

For production applications, consider:

- **SSL Connections:** Enable SSL by setting `ssl: true` in your connection configuration.
- **Connection Pooling:** Adjust `maxConnections` based on your application's concurrent usage.
- **Environment Variables:** Store database credentials securely using environment variables.
- **Database Backups:** Implement regular backup strategies for your PostgreSQL database.

## Use Cases

- **Production Applications:** Enterprise-grade applications requiring robust, scalable database storage.
- **Existing PostgreSQL Infrastructure:** Applications already using PostgreSQL for other data.
- **Complex Queries:** Scenarios requiring advanced SQL capabilities or data analytics.
- **High Availability:** Applications requiring database replication and failover capabilities.
- **Team Collaboration:** Multi-user applications where conversation data needs to be shared or analyzed.

## Error Handling

```typescript
try {
  await storage.addMessage(message, userId, conversationId);
} catch (error) {
  if (error.message.includes("foreign key constraint")) {
    console.error("Conversation does not exist");
  } else {
    console.error("Database error:", error);
  }
}
```
