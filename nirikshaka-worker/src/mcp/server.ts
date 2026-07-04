import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "../config";
import { createPrismaClient } from "../db/client";
import { asQueryable, createSqlPool } from "../db/sql";
import { registerTools } from "./tools";
import type { McpDeps } from "./service";

/**
 * MCP entry point (doc §6) — a SEPARATE process from the worker: stdio needs
 * exclusive stdout, and MCP sessions must survive worker restarts.
 *
 *   stdio (default):  claude mcp add nirikshaka -- node dist/src/mcp/server.js
 *   http:             MCP_TRANSPORT=http node dist/src/mcp/server.js
 *                     (Streamable HTTP on MCP_HTTP_PORT, x-agent-secret auth)
 */

function buildServer(deps: McpDeps): McpServer {
  const server = new McpServer({ name: "nirikshaka", version: "0.2.0" });
  registerTools(server, deps);
  return server;
}

async function main(): Promise<void> {
  const config = loadConfig();

  const isStdio = config.MCP_TRANSPORT === "stdio";
  if (isStdio) {
    // stdout carries JSON-RPC frames — anything else corrupts the session.
    console.log = console.error.bind(console);
    console.info = console.error.bind(console);
  }

  const prisma = createPrismaClient(config.DATABASE_URL);
  const pool = createSqlPool(config.DATABASE_URL);
  const deps: McpDeps = { prisma, sql: asQueryable(pool), config };

  if (isStdio) {
    const server = buildServer(deps);
    await server.connect(new StdioServerTransport());
    console.error("[mcp] nirikshaka MCP server on stdio");
    return;
  }

  // Streamable HTTP, stateless: fresh server+transport per request, guarded
  // by the same shared secret the dashboard's agent routes use.
  const http = createServer(async (req, res) => {
    if (config.AGENT_SHARED_SECRET) {
      const secret = req.headers["x-agent-secret"];
      if (secret !== config.AGENT_SHARED_SECRET) {
        res.writeHead(401, { "content-type": "application/json" }).end(
          JSON.stringify({ error: "Unauthorized" })
        );
        return;
      }
    } else {
      console.warn("[mcp] AGENT_SHARED_SECRET not set — HTTP transport is UNAUTHENTICATED");
    }
    try {
      const server = buildServer(deps);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error: unknown) {
      console.error(
        `[mcp] request failed: ${error instanceof Error ? error.message : String(error)}`
      );
      if (!res.headersSent) {
        res.writeHead(500).end();
      }
    }
  });

  http.listen(config.MCP_HTTP_PORT, () => {
    console.log(`[mcp] nirikshaka MCP server on http://0.0.0.0:${config.MCP_HTTP_PORT}`);
  });

  const shutdown = () => {
    http.close();
    void prisma.$disconnect();
    void pool.end();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[mcp] fatal:", error);
  process.exit(1);
});
