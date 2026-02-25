#!/usr/bin/env node

/**
 * Persistent HTTP server for Stream Deck button commands.
 * Keeps Tuya auth token cached so button presses are near-instant.
 *
 * Start: node build/server.js
 * Usage: curl -s http://localhost:7891/toggle
 */

import http from "node:http";
import * as tuya from "./lights/tuya.js";

const PORT = 7891;

async function forEachDevice(
  fn: (id: string) => Promise<unknown>
): Promise<string[]> {
  const ids = await tuya.getDeviceIds();
  const results: string[] = [];
  await Promise.all(
    ids.map(async (id) => {
      try {
        const r = await fn(id);
        results.push(`${id}: ${r ?? "ok"}`);
      } catch (err) {
        results.push(`${id}: error - ${err}`);
      }
    })
  );
  return results;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url!, `http://localhost:${PORT}`);
  const parts = url.pathname.split("/").filter(Boolean);
  const cmd = parts[0];

  res.setHeader("Content-Type", "text/plain");

  try {
    let msg = "ok";

    switch (cmd) {
      case "toggle":
        await forEachDevice(async (id) => {
          const s = await tuya.toggleSwitch(id);
          return s ? "ON" : "OFF";
        });
        msg = "toggled";
        break;

      case "on":
        await tuya.allOn();
        msg = "all on";
        break;

      case "off":
        await tuya.allOff();
        msg = "all off";
        break;

      case "brightness-up":
        await forEachDevice((id) => tuya.adjustBrightness(id, 15));
        msg = "brightness up";
        break;

      case "brightness-down":
        await forEachDevice((id) => tuya.adjustBrightness(id, -15));
        msg = "brightness down";
        break;

      case "brightness": {
        const val = parseInt(parts[1] ?? "50", 10);
        await forEachDevice((id) => tuya.setBrightness(id, val));
        msg = `brightness ${val}%`;
        break;
      }

      case "color": {
        const h = parseInt(parts[1] ?? "0", 10);
        const s = parseInt(parts[2] ?? "1000", 10);
        const v = parseInt(parts[3] ?? "1000", 10);
        await forEachDevice((id) => tuya.setColor(id, h, s, v));
        msg = `color h=${h} s=${s} v=${v}`;
        break;
      }

      case "white": {
        const temp = parseInt(parts[1] ?? "500", 10);
        await forEachDevice((id) =>
          tuya.setTemperature(id, Math.round(temp / 10))
        );
        msg = `white temp=${temp}`;
        break;
      }

      case "status": {
        const ids = await tuya.getDeviceIds();
        const statuses = await Promise.all(
          ids.map((id) => tuya.getDeviceStatus(id).catch((e) => ({ id, error: String(e) })))
        );
        res.writeHead(200);
        res.end(JSON.stringify(statuses, null, 2));
        return;
      }

      case "health":
        msg = "ok";
        break;

      default:
        res.writeHead(404);
        res.end("unknown command");
        return;
    }

    res.writeHead(200);
    res.end(msg);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
});

// Pre-warm: load config and get a token on startup
console.log("Starting light control server...");
tuya
  .loadConfig()
  .then(() => {
    console.log("Tuya config loaded, token will be fetched on first request");
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`Light server ready on http://127.0.0.1:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to load config:", err);
    process.exit(1);
  });
