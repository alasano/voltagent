import type { OpenAPIHono } from "@hono/zod-openapi";
import { createRoute } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { ServerAdapter, type RouteDefinition } from "@voltagent/server-adapter";

/**
 * Hono-specific server adapter implementation
 */
export class HonoServerAdapter extends ServerAdapter {
  constructor(private app: OpenAPIHono) {
    super();
    // Configure CORS directly on the app
    this.app.use(
      "/*",
      cors({
        origin: "*",
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
        allowHeaders: ["Content-Type", "Authorization"],
        exposeHeaders: ["Content-Length", "X-Kuma-Revision"],
        maxAge: 600,
        credentials: true,
      }),
    );
  }

  addRoute(route: RouteDefinition): void {
    this.registeredRoutes.push(route);

    if (route.openapi) {
      // Create the OpenAPI route definition
      const openAPIRoute = createRoute({
        method: route.method,
        path: route.path,
        request: route.openapi.request,
        responses: route.openapi.responses,
        tags: route.openapi.tags,
        summary: route.openapi.summary,
        description: route.openapi.description,
      });

      this.app.openapi(openAPIRoute, async (c: any) => {
        try {
          // Use validated data when schemas are provided, fallback to raw data otherwise
          const params = route.openapi?.request?.params ? c.req.valid("param") : c.req.param();
          const query = route.openapi?.request?.query ? c.req.valid("query") : c.req.query();
          const body = route.openapi?.request?.body ? c.req.valid("json") : undefined;

          const context = {
            params,
            query,
            body,
            headers: this.extractHeaders(c),
            context: c,
          };

          const result = await route.handler(params, context);

          // Handle HTML response
          if (result?.contentType === "text/html") {
            return c.html(result.content);
          }

          return c.json(result);
        } catch (error) {
          console.error(
            `Error in OpenAPI route ${route.method.toUpperCase()} ${route.path}:`,
            error,
          );
          return c.json(
            {
              success: false,
              error: error instanceof Error ? error.message : "Internal server error",
            },
            500,
          );
        }
      });
    } else {
      // Fallback to simple route
      const app = this.app as any;
      app[route.method](route.path, async (c: any) => {
        try {
          const params = c.req.param();
          const query = c.req.query();
          const body =
            route.method !== "get" && route.method !== "head"
              ? await c.req.json().catch(() => undefined)
              : undefined;

          const context = {
            params,
            query,
            body,
            headers: this.extractHeaders(c),
            context: c,
          };

          const result = await route.handler(params, context);

          if (result?.contentType === "text/html") {
            return c.html(result.content);
          }

          return c.json(result);
        } catch (error) {
          console.error(`Error in route ${route.method.toUpperCase()} ${route.path}:`, error);
          return c.json(
            {
              success: false,
              error: error instanceof Error ? error.message : "Internal server error",
            },
            500,
          );
        }
      });
    }
  }

  addStreamingRoute(route: RouteDefinition): void {
    this.registeredRoutes.push(route);

    const registerHandler = async (c: any) => {
      try {
        const params = route.openapi?.request?.params ? c.req.valid("param") : c.req.param();
        const query = route.openapi?.request?.query ? c.req.valid("query") : c.req.query();
        const body = route.openapi?.request?.body
          ? c.req.valid("json")
          : route.method !== "get" && route.method !== "head"
            ? await c.req.json().catch(() => undefined)
            : undefined;

        // Extract headers outside of the stream to preserve 'this' context
        const headers = this.extractHeaders(c);

        // Create SSE stream
        const stream = new ReadableStream({
          async start(controller) {
            try {
              // Create a flag to track if stream has been closed
              let streamClosed = false;

              // Helper function to safely enqueue data
              const safeEnqueue = (data: string) => {
                if (!streamClosed) {
                  try {
                    controller.enqueue(new TextEncoder().encode(data));
                  } catch (e) {
                    console.error("Failed to enqueue data:", e);
                    streamClosed = true;
                  }
                }
              };

              // Helper function to safely close stream
              const safeClose = () => {
                if (!streamClosed) {
                  try {
                    controller.close();
                    streamClosed = true;
                  } catch (e) {
                    console.error("Failed to close controller:", e);
                  }
                }
              };

              // Create a real-time SubAgent event forwarder
              const subAgentEventQueue: any[] = [];
              let isProcessingQueue = false;

              const processEventQueue = async () => {
                if (isProcessingQueue || subAgentEventQueue.length === 0) return;
                isProcessingQueue = true;

                while (subAgentEventQueue.length > 0 && !streamClosed) {
                  const event = subAgentEventQueue.shift();
                  if (event) {
                    const sseMessage = `data: ${JSON.stringify(event)}\n\n`;
                    safeEnqueue(sseMessage);
                  }
                }

                isProcessingQueue = false;
              };

              const streamEventForwarder = async (event: any) => {
                if (!streamClosed) {
                  subAgentEventQueue.push(event);
                  // Process queue asynchronously to avoid blocking SubAgent execution
                  setImmediate(processEventQueue);
                }
              };

              const context = {
                params,
                query,
                body,
                headers,
                context: c,
                streamEventForwarder, // Pass the real-time forwarder
              };

              const streamResult = await route.handler(params, context);

              // Iterate through the full stream if available, otherwise fallback to text stream
              try {
                if (streamResult?.fullStream) {
                  // Use fullStream for rich events (text, tool calls, reasoning, etc.)
                  for await (const part of streamResult.fullStream) {
                    if (streamClosed) break;

                    switch (part.type) {
                      case "text-delta": {
                        const data = {
                          text: part.textDelta,
                          timestamp: new Date().toISOString(),
                          type: "text",
                        };
                        const sseMessage = `data: ${JSON.stringify(data)}\n\n`;
                        safeEnqueue(sseMessage);
                        break;
                      }
                      case "reasoning": {
                        const data = {
                          reasoning: part.reasoning,
                          timestamp: new Date().toISOString(),
                          type: "reasoning",
                        };
                        const sseMessage = `data: ${JSON.stringify(data)}\n\n`;
                        safeEnqueue(sseMessage);
                        break;
                      }
                      case "source": {
                        const data = {
                          source: part.source,
                          timestamp: new Date().toISOString(),
                          type: "source",
                        };
                        const sseMessage = `data: ${JSON.stringify(data)}\n\n`;
                        safeEnqueue(sseMessage);
                        break;
                      }
                      case "tool-call": {
                        const data = {
                          toolCall: {
                            toolCallId: part.toolCallId,
                            toolName: part.toolName,
                            args: part.args,
                          },
                          timestamp: new Date().toISOString(),
                          type: "tool-call",
                        };
                        const sseMessage = `data: ${JSON.stringify(data)}\n\n`;
                        safeEnqueue(sseMessage);
                        break;
                      }
                      case "tool-result": {
                        // Send appropriate event type based on error status
                        const data = {
                          toolResult: {
                            toolCallId: part.toolCallId,
                            toolName: part.toolName,
                            result: part.result,
                          },
                          timestamp: new Date().toISOString(),
                          type: "tool-result",
                        };
                        const sseMessage = `data: ${JSON.stringify(data)}\n\n`;
                        safeEnqueue(sseMessage);

                        // Don't close stream for tool errors - continue processing
                        // Note: SubAgent events are now forwarded in real-time via streamEventForwarder
                        // No need to parse delegate_task results for batch forwarding
                        break;
                      }
                      case "finish": {
                        const data = {
                          finishReason: part.finishReason,
                          usage: part.usage,
                          timestamp: new Date().toISOString(),
                          type: "finish",
                        };
                        const sseMessage = `data: ${JSON.stringify(data)}\n\n`;
                        safeEnqueue(sseMessage);
                        break;
                      }
                      case "error": {
                        // Check if this is a tool error
                        const error = part.error as any;
                        const isToolError = error?.constructor?.name === "ToolExecutionError";

                        const errorData = {
                          error: (part.error as Error)?.message || "Stream error occurred",
                          timestamp: new Date().toISOString(),
                          type: "error",
                          code: isToolError ? "TOOL_ERROR" : "STREAM_ERROR",
                          // Include tool details if available
                          ...(isToolError && {
                            toolName: error?.toolName,
                            toolCallId: error?.toolCallId,
                          }),
                        };

                        const errorMessage = `data: ${JSON.stringify(errorData)}\n\n`;
                        safeEnqueue(errorMessage);

                        // Don't close stream for tool errors
                        if (!isToolError) {
                          safeClose();
                          return;
                        }
                        break;
                      }
                    }
                  }
                } else if (streamResult?.textStream) {
                  // Fallback to textStream for providers that don't support fullStream
                  for await (const textDelta of streamResult.textStream) {
                    if (streamClosed) break;

                    const data = {
                      text: textDelta,
                      timestamp: new Date().toISOString(),
                      type: "text",
                    };
                    const sseMessage = `data: ${JSON.stringify(data)}\n\n`;
                    safeEnqueue(sseMessage);
                  }
                } else if (streamResult?.objectStream) {
                  for await (const chunk of streamResult.objectStream) {
                    if (streamClosed) break;

                    const data = {
                      object: chunk,
                      timestamp: new Date().toISOString(),
                      type: "object",
                    };
                    const sseMessage = `data: ${JSON.stringify(data)}\n\n`;
                    safeEnqueue(sseMessage);
                  }
                }

                // Send completion message if stream completed successfully
                if (!streamClosed) {
                  const completionData = {
                    done: true,
                    timestamp: new Date().toISOString(),
                    type: "completion",
                  };
                  const completionMessage = `data: ${JSON.stringify(completionData)}\n\n`;
                  safeEnqueue(completionMessage);
                  safeClose();
                }
              } catch (iterationError) {
                // Handle errors during stream iteration
                console.error("Error during stream iteration:", iterationError);
                const errorData = {
                  error: (iterationError as Error)?.message ?? "Stream iteration failed",
                  timestamp: new Date().toISOString(),
                  type: "error",
                  code: "ITERATION_ERROR",
                };
                const errorMessage = `data: ${JSON.stringify(errorData)}\n\n`;
                safeEnqueue(errorMessage);
                safeClose();
              }
            } catch (error) {
              // Handle errors during initial setup
              console.error("Error during stream setup:", error);
              const errorData = {
                error: error instanceof Error ? error.message : "Stream setup failed",
                timestamp: new Date().toISOString(),
                type: "error",
                code: "SETUP_ERROR",
              };
              const errorMessage = `data: ${JSON.stringify(errorData)}\n\n`;
              try {
                controller.enqueue(new TextEncoder().encode(errorMessage));
              } catch (e) {
                console.error("Failed to send error message:", e);
              }
              try {
                controller.close();
              } catch (e) {
                console.error("Failed to close controller after error:", e);
              }
            }
          },
        });

        return c.body(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      } catch (error) {
        console.error(
          `Error in streaming route ${route.method.toUpperCase()} ${route.path}:`,
          error,
        );
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Internal server error",
          },
          500,
        );
      }
    };

    if (route.openapi) {
      const openAPIRoute = createRoute({
        method: route.method,
        path: route.path,
        request: route.openapi.request,
        responses: route.openapi.responses,
        tags: route.openapi.tags,
        summary: route.openapi.summary,
        description: route.openapi.description,
      });

      this.app.openapi(openAPIRoute, registerHandler);
    } else {
      const app = this.app as any;
      app[route.method](route.path, registerHandler);
    }
  }

  private extractHeaders(c: any): Record<string, string> {
    const headers: Record<string, string> = {};
    try {
      const headerData = c.req.header();
      if (headerData && typeof headerData === "object") {
        Object.keys(headerData).forEach((key) => {
          headers[key] = c.req.header(key) || "";
        });
      }
    } catch {
      // Continue with empty headers
    }
    return headers;
  }
}
