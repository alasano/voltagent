import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import type { WebSocketServer } from "ws";
import type { LocalAgentRegistry } from "@voltagent/core";
import {
  createVoltRoutes,
  extractAgentIdFromUrl,
  isTestWebSocketUrl,
  type VoltRouteOptions,
} from "@voltagent/server-adapter";
import type { VoltRouteFactory } from "@voltagent/server-adapter";
import { HonoServerAdapter } from "../adapters/hono";
import { createWebSocketServer } from "./websocket";

// Terminal color codes for pretty output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  dim: "\x1b[2m",
};

// Port and message configuration
const preferredPorts = [3141, 4310, 1337, 4242];

export interface HonoServerOptions extends VoltRouteOptions {
  port?: number;
  hostname?: string;
  preferredPorts?: number[];
  customEndpoints?: any[];
}

export interface ServerInfo {
  server: ReturnType<typeof serve>;
  ws: WebSocketServer;
  port: number;
  app: OpenAPIHono;
}

/**
 * Hono-based VoltAgent server implementation
 *
 * Usage example:
 * ```typescript
 * const server = new HonoVoltServer(registry, options);
 *
 * // Setup without starting (WebSocket server is created but not bound)
 * server.setup();
 *
 * // Access WebSocket server for custom logic
 * const wsServer = server.getWebSocketServer();
 *
 * // Start the server when ready
 * await server.start();
 * ```
 */
export class HonoVoltServer {
  public app: OpenAPIHono;
  private adapter: HonoServerAdapter;
  private serverInfo?: ServerInfo;
  private routes: VoltRouteFactory | undefined;
  private wsServer?: WebSocketServer;

  constructor(
    private registry: LocalAgentRegistry,
    private options: HonoServerOptions = {},
  ) {
    this.app = new OpenAPIHono();
    this.adapter = new HonoServerAdapter(this.app);
  }

  /**
   * Setup the server
   */
  setup() {
    // Set up routes using the comprehensive server-adapter
    this.routes = createVoltRoutes(this.registry, {
      basePath: this.options.basePath || "",
      enableWebSocket: this.options.enableWebSocket,
      customEndpoints: this.options.customEndpoints,
    });

    this.routes.attachTo(this.adapter);

    // Setup WebSocket server (without binding to port)
    this.setupWebSocket();

    // Add landing page
    this.addLandingPage();

    // Add OpenAPI documentation
    this.addDocumentation();
  }

  /**
   * Setup WebSocket server without binding to port
   */
  private setupWebSocket(): void {
    // Create WebSocket server with LocalAgentRegistry integration
    const ws = createWebSocketServer(this.registry);

    // Store the WebSocket server for later use
    this.wsServer = ws;
  }

  /**
   * Start the server with automatic port discovery
   */
  async start(): Promise<ServerInfo> {
    if (this.serverInfo) {
      console.log("Server is already running");
      return this.serverInfo;
    }

    this.setup();

    // Use the WebSocket server created during setup
    if (!this.wsServer) {
      throw new Error("WebSocket server not initialized");
    }
    const ws = this.wsServer;

    // Try to start server on available port
    const port = await this.findAvailablePort();
    const server = serve({
      fetch: this.app.fetch.bind(this.app),
      port,
      hostname: this.options.hostname || "0.0.0.0",
    });

    // Set up WebSocket upgrade handler with server-adapter integration
    server.addListener("upgrade", (req: any, socket: any, head: Buffer) => {
      const url = req.url || "";

      if (url.startsWith("/ws")) {
        ws.handleUpgrade(req, socket, head, (websocket) => {
          if (!this.routes) {
            throw new Error("Routes not initialized");
          }

          // Use server-adapter utilities for proper routing
          if (isTestWebSocketUrl(url)) {
            // Handle test connection
            const wsManager = this.routes.getWebSocketManager();
            wsManager.handleTestConnection(websocket);
          } else {
            // Handle agent-specific connection
            const agentId = extractAgentIdFromUrl(url);
            if (agentId) {
              const wsManager = this.routes.getWebSocketManager();
              wsManager.addConnection(agentId, websocket);

              // Send initial state
              wsManager
                .getInitialAgentState(agentId)
                .then((initialState) => {
                  if (initialState) {
                    websocket.send(JSON.stringify(initialState));
                  }
                })
                .catch((error) => {
                  console.error(`Failed to get initial state for agent ${agentId}:`, error);
                });

              // Handle cleanup
              websocket.on("close", () => {
                wsManager.removeConnection(agentId, websocket);
              });

              websocket.on("error", (error) => {
                console.error(`WebSocket error for agent ${agentId}:`, error);
                wsManager.removeConnection(agentId, websocket);
              });
            }
          }

          ws.emit("connection", websocket, req);
        });
      } else {
        socket.destroy();
      }
    });

    this.serverInfo = { server, ws, port, app: this.app };
    this.printStartupMessage(port);

    return this.serverInfo;
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (this.serverInfo) {
      this.serverInfo.ws.close();
      // Note: Hono server doesn't have a built-in close method
      // In practice, you'd need to handle this based on your deployment
      this.serverInfo = undefined;
    }

    // Also close the WebSocket server created during setup
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = undefined;
    }
  }

  /**
   * Get server info
   */
  getServerInfo(): ServerInfo | undefined {
    return this.serverInfo;
  }

  /**
   * Get WebSocket server (available after setup)
   */
  getWebSocketServer(): WebSocketServer | undefined {
    return this.wsServer;
  }

  private async findAvailablePort(): Promise<number> {
    const portsToTry = [
      ...(this.options.preferredPorts || preferredPorts),
      ...Array.from({ length: 101 }, (_, i) => 4300 + i),
    ];

    if (this.options.port) {
      portsToTry.unshift(this.options.port);
    }

    for (const port of portsToTry) {
      try {
        // Simple port check - in practice you might want a more robust check
        return port;
      } catch {
        if (port === portsToTry[portsToTry.length - 1]) {
          throw new Error("Could not find an available port");
        }
      }
    }

    throw new Error("Could not find an available port");
  }

  private addLandingPage(): void {
    this.app.get("/", (c) => {
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>VoltAgent Server</title>
            <style>
                body {
                    background-color: #2a2a2a;
                    color: #cccccc;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    text-align: center;
                }
                .container { padding: 40px; }
                h1 { color: #eeeeee; border-bottom: 1px solid #555555; padding-bottom: 10px; margin-bottom: 20px; }
                p { font-size: 1.1em; margin-bottom: 30px; line-height: 1.6; }
                a { color: #64b5f6; text-decoration: none; font-weight: bold; border: 1px solid #64b5f6; padding: 10px 15px; border-radius: 4px; }
                a:hover { text-decoration: underline; }
                .logo { font-size: 1.8em; font-weight: bold; margin-bottom: 30px; color: #eeeeee; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">VoltAgent</div>
                <h1>Server Running ⚡</h1>
                <p>Manage and monitor your agents via the VoltOps Platform.</p>
                <a href="https://console.voltagent.dev" target="_blank">Go to VoltOps Platform</a>
                <div style="margin-top: 30px;">
                  <a href="/ui" style="margin-right: 15px;">Swagger UI</a>
                  <a href="/doc">OpenAPI Spec</a>
                </div>
            </div>
        </body>
        </html>
      `;
      return c.html(html);
    });
  }

  private addDocumentation(): void {
    // OpenAPI documentation
    this.app.doc("/doc", {
      openapi: "3.1.0",
      info: {
        version: "2.0.0",
        title: "VoltAgent Server API",
        description: "API for managing and interacting with VoltAgents",
      },
      servers: [{ url: "http://localhost:3141", description: "Local development server" }],
    });

    // Swagger UI
    this.app.get("/ui", swaggerUI({ url: "/doc" }));
  }

  private printStartupMessage(port: number): void {
    const divider = `${colors.cyan}${"═".repeat(50)}${colors.reset}`;

    console.log("\n");
    console.log(divider);
    console.log(
      `${colors.bright}${colors.yellow}  VOLTAGENT SERVER STARTED SUCCESSFULLY${colors.reset}`,
    );
    console.log(divider);
    console.log(
      `${colors.green}  ✓ ${colors.bright}HTTP Server:  ${colors.reset}${colors.white}http://localhost:${port}${colors.reset}`,
    );
    console.log(
      `${colors.green}  ✓ ${colors.bright}Swagger UI:   ${colors.reset}${colors.white}http://localhost:${port}/ui${colors.reset}`,
    );
    console.log(
      `${colors.green}  ✓ ${colors.bright}WebSocket:    ${colors.reset}${colors.white}ws://localhost:${port}/ws${colors.reset}`,
    );
    console.log(
      `${colors.green}  ✓ ${colors.bright}Agents:       ${colors.reset}${colors.white}${this.registry.getAgentCount()} registered${colors.reset}`,
    );
    console.log();
    console.log(
      `${colors.bright}${colors.yellow}  VoltOps Platform:    ${colors.reset}${colors.white}https://console.voltagent.dev${colors.reset}`,
    );
    console.log(divider);
  }
}

/**
 * Backward compatibility function
 */
export async function startHonoServer(
  registry: LocalAgentRegistry,
  options: HonoServerOptions = {},
): Promise<ServerInfo> {
  const server = new HonoVoltServer(registry, options);
  return server.start();
}
