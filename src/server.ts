#!/usr/bin/env node

/**
 * Persistent HTTP server for Stream Deck button commands.
 * Fire-and-forget: returns 200 instantly, runs Tuya calls in background.
 * Local state cache eliminates read-before-write round-trips.
 *
 * Start: node build/server.js
 * Usage: curl -s http://localhost:7891/toggle
 */

import http from "node:http";
import * as tuya from "./lights/tuya.js";

const PORT = 7891;

// ── Local state cache ──
// Eliminates the need to read from Tuya API before every command.

interface DeviceState {
  on: boolean;
  brightness: number; // 10-1000 raw Tuya scale
  workMode: string;
  colour: { h: number; s: number; v: number };
}

const cache = new Map<string, DeviceState>();
let deviceIds: string[] = [];

function getState(id: string): DeviceState {
  let s = cache.get(id);
  if (!s) {
    s = { on: true, brightness: 500, workMode: "white", colour: { h: 0, s: 0, v: 1000 } };
    cache.set(id, s);
  }
  return s;
}

// Fire command to all devices in parallel, don't await
function fireAll(fn: (id: string) => Promise<unknown>): void {
  for (const id of deviceIds) {
    fn(id).catch((e) => console.error(`${id}: ${e}`));
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url!, `http://localhost:${PORT}`);
  const parts = url.pathname.split("/").filter(Boolean);
  const cmd = parts[0];

  // Return immediately for all commands (fire-and-forget)
  if (cmd === "health") {
    res.writeHead(200);
    res.end("ok");
    return;
  }

  if (cmd === "status") {
    // Status is the one command that needs to await
    Promise.all(
      deviceIds.map((id) =>
        tuya.getDeviceStatus(id).catch((e) => ({ id, error: String(e) }))
      )
    ).then((statuses) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(statuses, null, 2));
    });
    return;
  }

  // Everything else: respond immediately, execute in background
  res.writeHead(200);
  res.end("ok");

  switch (cmd) {
    case "toggle":
      fireAll(async (id) => {
        const s = getState(id);
        s.on = !s.on;
        await tuya.setSwitch(id, s.on);
      });
      break;

    case "on":
      fireAll(async (id) => {
        getState(id).on = true;
        await tuya.setSwitch(id, true);
      });
      break;

    case "off":
      fireAll(async (id) => {
        getState(id).on = false;
        await tuya.setSwitch(id, false);
      });
      break;

    case "brightness-up":
      fireAll(async (id) => {
        const s = getState(id);
        if (s.workMode === "colour") {
          s.colour.v = Math.min(1000, s.colour.v + 150);
          await tuya.tuyaPost(`/v1.0/devices/${id}/commands`, {
            commands: [{ code: "colour_data_v2", value: JSON.stringify(s.colour) }],
          });
        } else {
          s.brightness = Math.min(1000, s.brightness + 150);
          await tuya.tuyaPost(`/v1.0/devices/${id}/commands`, {
            commands: [{ code: "bright_value_v2", value: s.brightness }],
          });
        }
      });
      break;

    case "brightness-down":
      fireAll(async (id) => {
        const s = getState(id);
        if (s.workMode === "colour") {
          s.colour.v = Math.max(10, s.colour.v - 150);
          await tuya.tuyaPost(`/v1.0/devices/${id}/commands`, {
            commands: [{ code: "colour_data_v2", value: JSON.stringify(s.colour) }],
          });
        } else {
          s.brightness = Math.max(10, s.brightness - 150);
          await tuya.tuyaPost(`/v1.0/devices/${id}/commands`, {
            commands: [{ code: "bright_value_v2", value: s.brightness }],
          });
        }
      });
      break;

    case "brightness": {
      const pct = parseInt(parts[1] ?? "50", 10);
      const mapped = Math.max(10, Math.min(1000, Math.round((pct / 100) * 990 + 10)));
      fireAll(async (id) => {
        const s = getState(id);
        if (s.workMode === "colour") {
          s.colour.v = mapped;
          await tuya.tuyaPost(`/v1.0/devices/${id}/commands`, {
            commands: [{ code: "colour_data_v2", value: JSON.stringify(s.colour) }],
          });
        } else {
          s.brightness = mapped;
          await tuya.tuyaPost(`/v1.0/devices/${id}/commands`, {
            commands: [{ code: "bright_value_v2", value: mapped }],
          });
        }
      });
      break;
    }

    case "color": {
      const h = parseInt(parts[1] ?? "0", 10);
      const s = parseInt(parts[2] ?? "1000", 10);
      const v = parseInt(parts[3] ?? "1000", 10);
      fireAll(async (id) => {
        const st = getState(id);
        st.workMode = "colour";
        st.colour = { h, s, v };
        await tuya.tuyaPost(`/v1.0/devices/${id}/commands`, {
          commands: [
            { code: "work_mode", value: "colour" },
            { code: "colour_data_v2", value: JSON.stringify({ h, s, v }) },
          ],
        });
      });
      break;
    }

    case "white": {
      const temp = parseInt(parts[1] ?? "500", 10);
      fireAll(async (id) => {
        const st = getState(id);
        st.workMode = "white";
        await tuya.tuyaPost(`/v1.0/devices/${id}/commands`, {
          commands: [
            { code: "work_mode", value: "white" },
            { code: "temp_value_v2", value: temp },
          ],
        });
      });
      break;
    }
  }
});

// ── Startup: load config, pre-warm token + state cache ──

console.log("Starting light control server...");
tuya
  .loadConfig()
  .then(async (config) => {
    deviceIds = config.deviceIds;

    // Pre-warm the auth token
    try {
      await tuya.tuyaGet("/v1.0/token?grant_type=1").catch(() => {});
    } catch {}

    // Pre-fetch device state into cache
    await Promise.all(
      deviceIds.map(async (id) => {
        try {
          const status = (await tuya.tuyaGet(`/v1.0/devices/${id}/status`)) as {
            code: string;
            value: unknown;
          }[];
          const m: Record<string, unknown> = {};
          for (const s of status ?? []) m[s.code] = s.value;

          const colourStr = (m.colour_data_v2 ?? '{"h":0,"s":0,"v":1000}') as string;
          let colour = { h: 0, s: 0, v: 1000 };
          try { colour = JSON.parse(colourStr); } catch {}

          cache.set(id, {
            on: (m.switch_led ?? m.switch_1 ?? true) as boolean,
            brightness: (m.bright_value_v2 ?? m.bright_value ?? 500) as number,
            workMode: (m.work_mode ?? "white") as string,
            colour,
          });
          console.log(`  Cached state for ${id}`);
        } catch (e) {
          console.error(`  Failed to cache ${id}: ${e}`);
        }
      })
    );

    server.listen(PORT, "127.0.0.1", () => {
      console.log(`Light server ready on http://127.0.0.1:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
  });
