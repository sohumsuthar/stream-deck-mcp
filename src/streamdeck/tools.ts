import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as profiles from "./profiles.js";

export function registerStreamDeckTools(server: McpServer): void {
  server.tool(
    "streamdeck_list_profiles",
    "List all Stream Deck profiles configured in the Stream Deck software",
    {},
    async () => {
      try {
        const list = await profiles.listProfiles();
        if (list.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No profiles found. Is the Elgato Stream Deck software installed?",
              },
            ],
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
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
    "streamdeck_get_layout",
    "Get the current button layout showing what action is assigned to each button on the Stream Deck",
    {
      profileId: z
        .string()
        .optional()
        .describe("Profile ID (from streamdeck_list_profiles). Uses default if omitted."),
      pageId: z
        .string()
        .optional()
        .describe("Page ID. Uses current page if omitted."),
    },
    async ({ profileId, pageId }) => {
      try {
        const layout = await profiles.getLayout(profileId, pageId);
        return {
          content: [{ type: "text", text: JSON.stringify(layout, null, 2) }],
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
    "streamdeck_add_hotkey",
    "Add a keyboard shortcut/hotkey action to a Stream Deck button. After adding, call streamdeck_reload to apply changes.",
    {
      row: z.number().min(0).describe("Button row (0-based, top is 0)"),
      col: z.number().min(0).describe("Button column (0-based, left is 0)"),
      vKeyCode: z
        .number()
        .describe(
          "Windows virtual key code for the key. Common codes: A=65, B=66...Z=90, 0=48...9=57, F1=112...F12=123, Enter=13, Escape=27, Space=32, Tab=9, Backspace=8, Delete=46, PrintScreen=44, Pause=19"
        ),
      ctrl: z.boolean().optional().describe("Hold Ctrl (default: false)"),
      shift: z.boolean().optional().describe("Hold Shift (default: false)"),
      alt: z.boolean().optional().describe("Hold Alt (default: false)"),
      win: z.boolean().optional().describe("Hold Windows key (default: false)"),
      title: z
        .string()
        .optional()
        .describe("Label to show on the button"),
      profileId: z.string().optional().describe("Profile ID (default profile if omitted)"),
      pageId: z.string().optional().describe("Page ID (current page if omitted)"),
    },
    async ({ row, col, vKeyCode, ctrl, shift, alt, win, title, profileId, pageId }) => {
      try {
        await profiles.addHotkey(
          row,
          col,
          { ctrl, shift, alt, win, key: "", vKeyCode },
          title,
          profileId,
          pageId
        );
        return {
          content: [
            {
              type: "text",
              text: `Hotkey added at button [${row},${col}]${title ? ` with title "${title}"` : ""}. Call streamdeck_reload to apply.`,
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
    "streamdeck_add_website",
    "Add a website/URL action to a Stream Deck button. Pressing the button will open the URL in the default browser. Call streamdeck_reload to apply.",
    {
      row: z.number().min(0).describe("Button row (0-based)"),
      col: z.number().min(0).describe("Button column (0-based)"),
      url: z.string().describe("URL to open (e.g. https://github.com)"),
      title: z.string().optional().describe("Label to show on the button"),
      profileId: z.string().optional().describe("Profile ID"),
      pageId: z.string().optional().describe("Page ID"),
    },
    async ({ row, col, url, title, profileId, pageId }) => {
      try {
        await profiles.addWebsite(row, col, url, title, profileId, pageId);
        return {
          content: [
            {
              type: "text",
              text: `Website action added at [${row},${col}] → ${url}. Call streamdeck_reload to apply.`,
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
    "streamdeck_add_app",
    "Add an application launcher to a Stream Deck button. Call streamdeck_reload to apply.",
    {
      row: z.number().min(0).describe("Button row (0-based)"),
      col: z.number().min(0).describe("Button column (0-based)"),
      appPath: z
        .string()
        .describe(
          'Full path to the application executable, or a system command like "notepad", "calc", "mspaint"'
        ),
      title: z.string().optional().describe("Label to show on the button"),
      profileId: z.string().optional().describe("Profile ID"),
      pageId: z.string().optional().describe("Page ID"),
    },
    async ({ row, col, appPath, title, profileId, pageId }) => {
      try {
        await profiles.addAppLaunch(row, col, appPath, title, profileId, pageId);
        return {
          content: [
            {
              type: "text",
              text: `App launcher added at [${row},${col}] → ${appPath}. Call streamdeck_reload to apply.`,
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
    "streamdeck_add_text",
    "Add a text paste action to a Stream Deck button. Pressing the button will type/paste the specified text. Call streamdeck_reload to apply.",
    {
      row: z.number().min(0).describe("Button row (0-based)"),
      col: z.number().min(0).describe("Button column (0-based)"),
      text: z.string().describe("Text to paste when the button is pressed"),
      sendEnter: z
        .boolean()
        .optional()
        .describe("Press Enter after pasting (default: false)"),
      title: z.string().optional().describe("Label to show on the button"),
      profileId: z.string().optional().describe("Profile ID"),
      pageId: z.string().optional().describe("Page ID"),
    },
    async ({ row, col, text, sendEnter, title, profileId, pageId }) => {
      try {
        await profiles.addText(row, col, text, sendEnter, title, profileId, pageId);
        return {
          content: [
            {
              type: "text",
              text: `Text action added at [${row},${col}]. Call streamdeck_reload to apply.`,
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
    "streamdeck_add_multimedia",
    "Add a media control button (play/pause, next, previous, volume up/down, mute). Call streamdeck_reload to apply.",
    {
      row: z.number().min(0).describe("Button row (0-based)"),
      col: z.number().min(0).describe("Button column (0-based)"),
      mediaAction: z
        .enum([
          "play_pause",
          "next",
          "previous",
          "volume_up",
          "volume_down",
          "mute",
        ])
        .describe("The media control action"),
      title: z.string().optional().describe("Label to show on the button"),
      profileId: z.string().optional().describe("Profile ID"),
      pageId: z.string().optional().describe("Page ID"),
    },
    async ({ row, col, mediaAction, title, profileId, pageId }) => {
      try {
        await profiles.addMultimedia(row, col, mediaAction, title, profileId, pageId);
        return {
          content: [
            {
              type: "text",
              text: `Media action "${mediaAction}" added at [${row},${col}]. Call streamdeck_reload to apply.`,
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
    "streamdeck_remove_action",
    "Remove the action from a Stream Deck button, making it blank. Call streamdeck_reload to apply.",
    {
      row: z.number().min(0).describe("Button row (0-based)"),
      col: z.number().min(0).describe("Button column (0-based)"),
      profileId: z.string().optional().describe("Profile ID"),
      pageId: z.string().optional().describe("Page ID"),
    },
    async ({ row, col, profileId, pageId }) => {
      try {
        await profiles.removeAction(row, col, profileId, pageId);
        return {
          content: [
            {
              type: "text",
              text: `Action removed from [${row},${col}]. Call streamdeck_reload to apply.`,
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
    "streamdeck_set_title",
    "Change the title/label displayed on a Stream Deck button. Call streamdeck_reload to apply.",
    {
      row: z.number().min(0).describe("Button row (0-based)"),
      col: z.number().min(0).describe("Button column (0-based)"),
      title: z.string().describe("New title text"),
      titleColor: z
        .string()
        .optional()
        .describe("Title color as hex (e.g. #ff0000 for red). Default: white"),
      profileId: z.string().optional().describe("Profile ID"),
      pageId: z.string().optional().describe("Page ID"),
    },
    async ({ row, col, title, titleColor, profileId, pageId }) => {
      try {
        await profiles.setButtonTitle(row, col, title, titleColor, profileId, pageId);
        return {
          content: [
            {
              type: "text",
              text: `Title set to "${title}" on button [${row},${col}]. Call streamdeck_reload to apply.`,
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
    "streamdeck_reload",
    "Restart the Stream Deck software to apply any profile changes made with the add/remove tools",
    {},
    async () => {
      try {
        const result = await profiles.reloadStreamDeck();
        return {
          content: [{ type: "text", text: result }],
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
