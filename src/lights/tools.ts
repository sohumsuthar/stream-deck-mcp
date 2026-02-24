import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as keylight from "./keylight.js";
import * as hue from "./hue.js";

export function registerLightTools(server: McpServer): void {
  // ── Elgato Key Light tools ──

  server.tool(
    "keylight_discover",
    "Discover Elgato Key Lights on the local network via mDNS. Returns a list of found lights with name, IP, and port.",
    {
      timeout: z
        .number()
        .optional()
        .describe("Discovery timeout in milliseconds (default: 5000)"),
    },
    async ({ timeout }) => {
      try {
        const lights = await keylight.discoverKeyLights(timeout);
        if (lights.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No Elgato Key Lights found on the network. Make sure they are powered on and connected to the same network.",
              },
            ],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(lights, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "keylight_get_status",
    "Get the current status of an Elgato Key Light (on/off, brightness, color temperature)",
    {
      ip: z.string().describe("IP address of the Key Light"),
      port: z.number().optional().describe("Port number (default: 9123)"),
    },
    async ({ ip, port }) => {
      try {
        const status = await keylight.getKeyLightStatus(ip, port);
        return {
          content: [
            { type: "text", text: JSON.stringify(status, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "keylight_set",
    "Set Elgato Key Light properties (on/off, brightness, color temperature)",
    {
      ip: z.string().describe("IP address of the Key Light"),
      on: z.boolean().optional().describe("Turn light on (true) or off (false)"),
      brightness: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe("Brightness percentage (0-100)"),
      temperature: z
        .number()
        .min(2900)
        .max(7000)
        .optional()
        .describe("Color temperature in Kelvin (2900-7000)"),
      port: z.number().optional().describe("Port number (default: 9123)"),
    },
    async ({ ip, on, brightness, temperature, port }) => {
      try {
        const result = await keylight.setKeyLight(
          ip,
          { on, brightness, temperature },
          port
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "keylight_toggle",
    "Toggle an Elgato Key Light on or off",
    {
      ip: z.string().describe("IP address of the Key Light"),
      port: z.number().optional().describe("Port number (default: 9123)"),
    },
    async ({ ip, port }) => {
      try {
        const result = await keylight.toggleKeyLight(ip, port);
        return {
          content: [
            {
              type: "text",
              text: `Light toggled. New state: ${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // ── Philips Hue tools ──

  server.tool(
    "hue_discover_bridge",
    "Discover Philips Hue Bridges on the network using the meethue.com discovery service",
    {},
    async () => {
      try {
        const bridges = await hue.discoverBridge();
        if (bridges.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No Hue Bridges found. Make sure the bridge is powered on and connected to the network.",
              },
            ],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(bridges, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "hue_pair",
    "Pair with a Philips Hue Bridge. IMPORTANT: The user must press the physical button on the Hue Bridge before calling this tool.",
    {
      bridgeIp: z
        .string()
        .describe("IP address of the Hue Bridge (from hue_discover_bridge)"),
    },
    async ({ bridgeIp }) => {
      try {
        const username = await hue.pairBridge(bridgeIp);
        return {
          content: [
            {
              type: "text",
              text: `Successfully paired with Hue Bridge! Credentials saved. Username: ${username}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "hue_list_lights",
    "List all Philips Hue lights with their current state. Requires prior pairing with hue_pair.",
    {},
    async () => {
      try {
        const lights = await hue.listLights();
        return {
          content: [
            { type: "text", text: JSON.stringify(lights, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "hue_set_light",
    "Control a specific Philips Hue light (on/off, brightness, color temperature, hue, saturation)",
    {
      lightId: z.string().describe("Light ID (from hue_list_lights)"),
      on: z.boolean().optional().describe("Turn light on or off"),
      brightness: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe("Brightness percentage (0-100)"),
      colorTemp: z
        .number()
        .min(2000)
        .max(6500)
        .optional()
        .describe("Color temperature in Kelvin (2000-6500)"),
      hue: z
        .number()
        .min(0)
        .max(65535)
        .optional()
        .describe("Hue value (0-65535, where 0 and 65535 are red)"),
      saturation: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe("Saturation percentage (0-100)"),
    },
    async ({ lightId, on, brightness, colorTemp, hue: hueVal, saturation }) => {
      try {
        await hue.setLight(lightId, {
          on,
          brightness,
          colorTemp,
          hue: hueVal,
          saturation,
        });
        return {
          content: [
            { type: "text", text: `Light ${lightId} updated successfully` },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "hue_list_groups",
    "List all Philips Hue light groups/rooms. Requires prior pairing with hue_pair.",
    {},
    async () => {
      try {
        const groups = await hue.listGroups();
        return {
          content: [
            { type: "text", text: JSON.stringify(groups, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "hue_set_group",
    "Control a Philips Hue light group/room (on/off, brightness, color temperature, hue, saturation)",
    {
      groupId: z.string().describe("Group ID (from hue_list_groups)"),
      on: z.boolean().optional().describe("Turn all lights in group on or off"),
      brightness: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe("Brightness percentage (0-100)"),
      colorTemp: z
        .number()
        .min(2000)
        .max(6500)
        .optional()
        .describe("Color temperature in Kelvin (2000-6500)"),
      hue: z
        .number()
        .min(0)
        .max(65535)
        .optional()
        .describe("Hue value (0-65535)"),
      saturation: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe("Saturation percentage (0-100)"),
    },
    async ({ groupId, on, brightness, colorTemp, hue: hueVal, saturation }) => {
      try {
        await hue.setGroup(groupId, {
          on,
          brightness,
          colorTemp,
          hue: hueVal,
          saturation,
        });
        return {
          content: [
            {
              type: "text",
              text: `Group ${groupId} updated successfully`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );
}
