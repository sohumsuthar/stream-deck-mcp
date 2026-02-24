import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as manager from "./manager.js";
import { renderText, loadImage } from "../utils/image.js";

export function registerStreamDeckTools(server: McpServer): void {
  server.tool(
    "streamdeck_list_devices",
    "List all connected Stream Deck devices",
    {},
    async () => {
      try {
        const devices = await manager.getDeviceList();
        if (devices.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No Stream Deck devices found. Make sure a device is connected via USB.",
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(devices, null, 2),
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
    "streamdeck_get_info",
    "Get detailed info about the connected Stream Deck (model, serial, button count, icon size)",
    {
      devicePath: z
        .string()
        .optional()
        .describe("Path to a specific device. If omitted, uses the first available device."),
    },
    async ({ devicePath }) => {
      try {
        const info = await manager.getInfo(devicePath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(info, null, 2),
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
    "streamdeck_set_brightness",
    "Set the brightness of the Stream Deck (0-100)",
    {
      brightness: z.number().min(0).max(100).describe("Brightness percentage (0-100)"),
      devicePath: z.string().optional().describe("Device path (optional)"),
    },
    async ({ brightness, devicePath }) => {
      try {
        await manager.setBrightness(brightness, devicePath);
        return {
          content: [
            { type: "text", text: `Brightness set to ${brightness}%` },
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
    "streamdeck_set_button_color",
    "Fill a Stream Deck button with a solid RGB color",
    {
      button: z.number().min(0).describe("Button index (0-based)"),
      r: z.number().min(0).max(255).describe("Red (0-255)"),
      g: z.number().min(0).max(255).describe("Green (0-255)"),
      b: z.number().min(0).max(255).describe("Blue (0-255)"),
      devicePath: z.string().optional().describe("Device path (optional)"),
    },
    async ({ button, r, g, b, devicePath }) => {
      try {
        await manager.fillColor(button, r, g, b, devicePath);
        return {
          content: [
            {
              type: "text",
              text: `Button ${button} set to RGB(${r}, ${g}, ${b})`,
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
    "streamdeck_set_button_image",
    "Set a Stream Deck button image from a URL or base64-encoded image",
    {
      button: z.number().min(0).describe("Button index (0-based)"),
      image: z
        .string()
        .describe(
          "Image source: URL (http/https), data URI, or raw base64-encoded image"
        ),
      devicePath: z.string().optional().describe("Device path (optional)"),
    },
    async ({ button, image, devicePath }) => {
      try {
        const info = await manager.getInfo(devicePath);
        const { width, height } = info.iconSize;
        const buffer = await loadImage(image, width, height);
        await manager.fillImage(button, buffer, devicePath);
        return {
          content: [
            { type: "text", text: `Button ${button} image set` },
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
    "streamdeck_set_button_text",
    "Render text on a Stream Deck button",
    {
      button: z.number().min(0).describe("Button index (0-based)"),
      text: z.string().describe("Text to display on the button"),
      fontSize: z.number().optional().describe("Font size in pixels (auto-calculated if omitted)"),
      color: z.string().optional().describe("Text color (CSS color string, default: white)"),
      backgroundColor: z
        .string()
        .optional()
        .describe("Background color (CSS color string, default: black)"),
      devicePath: z.string().optional().describe("Device path (optional)"),
    },
    async ({ button, text, fontSize, color, backgroundColor, devicePath }) => {
      try {
        const info = await manager.getInfo(devicePath);
        const { width, height } = info.iconSize;
        const buffer = await renderText(text, width, height, {
          fontSize,
          color,
          backgroundColor,
        });
        await manager.fillImage(button, buffer, devicePath);
        return {
          content: [
            {
              type: "text",
              text: `Button ${button} set to text: "${text}"`,
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
    "streamdeck_clear_button",
    "Clear a specific Stream Deck button (set to black)",
    {
      button: z.number().min(0).describe("Button index (0-based)"),
      devicePath: z.string().optional().describe("Device path (optional)"),
    },
    async ({ button, devicePath }) => {
      try {
        await manager.clearKey(button, devicePath);
        return {
          content: [
            { type: "text", text: `Button ${button} cleared` },
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
    "streamdeck_clear_all",
    "Clear all Stream Deck buttons (set to black)",
    {
      devicePath: z.string().optional().describe("Device path (optional)"),
    },
    async ({ devicePath }) => {
      try {
        await manager.clearPanel(devicePath);
        return {
          content: [
            { type: "text", text: "All buttons cleared" },
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
