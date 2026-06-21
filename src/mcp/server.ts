import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { callTool, getToolCatalog, type ToolName } from "../tools/registry.js";
import { credentialFieldsFor } from "../lib/platformCredentials.js";
import type { Platform } from "../types.js";

/** Phase 12: exposes the same tool registry the HTTP agent API (src/agent-api)
 * wraps, but over MCP's stdio transport — so Claude Desktop/Code (or any
 * other MCP client) can attach to Connect directly as a tool-using agent,
 * with the exact same dry-run/approval/audit-log behavior `callTool` already
 * enforces for every other caller. */
export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "mightymax-connect", version: "0.1.0" });

  for (const entry of getToolCatalog()) {
    server.registerTool(
      entry.name,
      {
        description: `${entry.description} (risk: ${entry.riskLevel}${entry.approvalRequired ? ", requires owner approval" : ""})`,
        inputSchema: {
          businessId: z.string().min(1).describe("The business id to run this tool against."),
          dryRun: z
            .boolean()
            .optional()
            .describe("If true, preview what this tool would do without performing any side effects."),
          input: z
            .record(z.string(), z.unknown())
            .optional()
            .describe("Tool-specific arguments beyond businessId/dryRun, e.g. { platform, values } for set_platform_credentials."),
        },
      },
      async ({ businessId, dryRun, input }) => {
        const result = await callTool(entry.name as ToolName, businessId, {
          source: "external_agent",
          dryRun,
          input: input as Record<string, unknown> | undefined,
        });
        return {
          isError: result.status === "failed",
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }
    );
  }

  server.registerTool(
    "get_platform_credential_fields",
    {
      description: "Lists which credential fields a platform expects, so an agent knows what to pass to set_platform_credentials.",
      inputSchema: {
        platform: z.string().min(1).describe("The platform name, e.g. facebook, gbp, pinterest."),
      },
    },
    async ({ platform }) => ({
      content: [{ type: "text", text: JSON.stringify({ platform, fields: credentialFieldsFor(platform as Platform) }, null, 2) }],
    })
  );

  return server;
}

const isMain = process.argv[1] && /server\.(ts|js)$/.test(process.argv[1]);
if (isMain) {
  const server = buildMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
