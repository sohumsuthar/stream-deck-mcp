#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerStreamDeckTools } from "./streamdeck/tools.js";
import { registerLightTools } from "./lights/tools.js";
import { registerCameraTools } from "./camera-tools.js";

const server = new McpServer({
  name: "stream-deck-mcp",
  version: "1.0.0",
});

registerStreamDeckTools(server);
registerLightTools(server);
registerCameraTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
