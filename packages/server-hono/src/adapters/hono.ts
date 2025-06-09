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
      });
    }
  }

  addStreamingRoute(route: RouteDefinition): void {
    this.registeredRoutes.push(route);

    const registerHandler = async (c: any) => {
      const params = route.openapi?.request?.params ? c.req.valid("param") : c.req.param();
      const query = route.openapi?.request?.query ? c.req.valid("query") : c.req.query();
      const body = route.openapi?.request?.body
        ? c.req.valid("json")
        : route.method !== "get" && route.method !== "head"
          ? await c.req.json().catch(() => undefined)
          : undefined;

      const context = {
        params,
        query,
        body,
        headers: this.extractHeaders(c),
        context: c,
      };

      const streamResult = await route.handler(params, context);

      // Create SSE stream
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();

          const send = (data: any) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          try {
            if (streamResult?.textStream) {
              for await (const chunk of streamResult.textStream) {
                send({ text: chunk, type: "text", timestamp: new Date().toISOString() });
              }
            } else if (streamResult?.objectStream) {
              const reader = streamResult.objectStream.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                send({ object: value, type: "object", timestamp: new Date().toISOString() });
              }
              reader.releaseLock();
            }

            send({ done: true, type: "completion", timestamp: new Date().toISOString() });
            controller.close();
          } catch (error) {
            send({
              error: error instanceof Error ? error.message : "Streaming failed",
              type: "error",
              timestamp: new Date().toISOString(),
            });
            controller.close();
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
