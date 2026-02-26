import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as camera from "./camera.js";

export function registerCameraTools(server: McpServer): void {
  server.tool(
    "camera_clip",
    "Save the last ~90 seconds of video from the webcam buffer as an MP4 clip. Auto-starts the buffer if not running.",
    {},
    async () => {
      if (!camera.isBuffering()) camera.startBuffering();
      const result = camera.saveClip();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.ok,
      };
    }
  );

  server.tool(
    "camera_start",
    "Start the continuous webcam buffer (1080p 60fps). The buffer keeps the last 90 seconds of video.",
    {},
    async () => {
      const result = camera.startBuffering();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.ok,
      };
    }
  );

  server.tool(
    "camera_stop",
    "Stop the webcam buffer",
    {},
    async () => {
      camera.stopBuffering();
      return { content: [{ type: "text", text: "Buffer stopped" }] };
    }
  );

  server.tool(
    "camera_status",
    "Check if the webcam buffer is running and how long it's been buffering",
    {},
    async () => {
      return {
        content: [{ type: "text", text: JSON.stringify(camera.getStatus(), null, 2) }],
      };
    }
  );
}
