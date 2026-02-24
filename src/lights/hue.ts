import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".stream-deck-mcp");
const CONFIG_FILE = join(CONFIG_DIR, "hue-config.json");

interface HueConfig {
  bridgeIp: string;
  username: string;
}

interface HueLight {
  id: string;
  name: string;
  type: string;
  on: boolean;
  brightness: number;
  colorTemp?: number;
  hue?: number;
  saturation?: number;
  reachable: boolean;
}

interface HueGroup {
  id: string;
  name: string;
  type: string;
  lights: string[];
  allOn: boolean;
  anyOn: boolean;
}

let cachedConfig: HueConfig | null = null;

async function loadConfig(): Promise<HueConfig | null> {
  if (cachedConfig) return cachedConfig;
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    cachedConfig = JSON.parse(raw) as HueConfig;
    return cachedConfig;
  } catch {
    return null;
  }
}

async function saveConfig(config: HueConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  cachedConfig = config;
}

function getConfig(): HueConfig {
  if (!cachedConfig) {
    throw new Error(
      "Hue bridge not configured. Use hue_discover_bridge and hue_pair first."
    );
  }
  return cachedConfig;
}

export async function discoverBridge(): Promise<{
  ip: string;
  id: string;
}[]> {
  // Try meethue.com discovery API
  const response = await fetch("https://discovery.meethue.com");
  if (!response.ok) throw new Error(`Hue discovery failed: ${response.status}`);
  const bridges = (await response.json()) as {
    id: string;
    internalipaddress: string;
  }[];

  return bridges.map((b) => ({
    ip: b.internalipaddress,
    id: b.id,
  }));
}

export async function pairBridge(bridgeIp: string): Promise<string> {
  const response = await fetch(`http://${bridgeIp}/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ devicetype: "stream-deck-mcp#claude" }),
  });
  if (!response.ok) throw new Error(`Hue API error: ${response.status}`);
  const result = (await response.json()) as (
    | { success: { username: string } }
    | { error: { description: string } }
  )[];

  const entry = result[0];
  if (!entry) throw new Error("Empty response from Hue bridge");
  if ("error" in entry) {
    throw new Error(
      `Hue pairing failed: ${entry.error.description}. Make sure you press the button on the Hue Bridge first, then try again.`
    );
  }

  const username = entry.success.username;
  await saveConfig({ bridgeIp, username });
  return username;
}

export async function listLights(): Promise<HueLight[]> {
  await loadConfig();
  const config = getConfig();
  const response = await fetch(
    `http://${config.bridgeIp}/api/${config.username}/lights`
  );
  if (!response.ok) throw new Error(`Hue API error: ${response.status}`);
  const data = (await response.json()) as Record<
    string,
    {
      name: string;
      type: string;
      state: {
        on: boolean;
        bri: number;
        ct?: number;
        hue?: number;
        sat?: number;
        reachable: boolean;
      };
    }
  >;

  return Object.entries(data).map(([id, light]) => ({
    id,
    name: light.name,
    type: light.type,
    on: light.state.on,
    brightness: Math.round((light.state.bri / 254) * 100),
    colorTemp: light.state.ct
      ? Math.round(1000000 / light.state.ct)
      : undefined,
    hue: light.state.hue,
    saturation: light.state.sat
      ? Math.round((light.state.sat / 254) * 100)
      : undefined,
    reachable: light.state.reachable,
  }));
}

export async function setLight(
  lightId: string,
  state: {
    on?: boolean;
    brightness?: number;
    colorTemp?: number;
    hue?: number;
    saturation?: number;
  }
): Promise<void> {
  await loadConfig();
  const config = getConfig();

  const body: Record<string, number | boolean> = {};
  if (state.on !== undefined) body.on = state.on;
  if (state.brightness !== undefined)
    body.bri = Math.round((Math.max(0, Math.min(100, state.brightness)) / 100) * 254);
  if (state.colorTemp !== undefined)
    body.ct = Math.round(
      1000000 / Math.max(2000, Math.min(6500, state.colorTemp))
    );
  if (state.hue !== undefined)
    body.hue = Math.max(0, Math.min(65535, state.hue));
  if (state.saturation !== undefined)
    body.sat = Math.round((Math.max(0, Math.min(100, state.saturation)) / 100) * 254);

  const response = await fetch(
    `http://${config.bridgeIp}/api/${config.username}/lights/${lightId}/state`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) throw new Error(`Hue API error: ${response.status}`);
}

export async function listGroups(): Promise<HueGroup[]> {
  await loadConfig();
  const config = getConfig();
  const response = await fetch(
    `http://${config.bridgeIp}/api/${config.username}/groups`
  );
  if (!response.ok) throw new Error(`Hue API error: ${response.status}`);
  const data = (await response.json()) as Record<
    string,
    {
      name: string;
      type: string;
      lights: string[];
      state: { all_on: boolean; any_on: boolean };
    }
  >;

  return Object.entries(data).map(([id, group]) => ({
    id,
    name: group.name,
    type: group.type,
    lights: group.lights,
    allOn: group.state.all_on,
    anyOn: group.state.any_on,
  }));
}

export async function setGroup(
  groupId: string,
  state: {
    on?: boolean;
    brightness?: number;
    colorTemp?: number;
    hue?: number;
    saturation?: number;
  }
): Promise<void> {
  await loadConfig();
  const config = getConfig();

  const body: Record<string, number | boolean> = {};
  if (state.on !== undefined) body.on = state.on;
  if (state.brightness !== undefined)
    body.bri = Math.round((Math.max(0, Math.min(100, state.brightness)) / 100) * 254);
  if (state.colorTemp !== undefined)
    body.ct = Math.round(
      1000000 / Math.max(2000, Math.min(6500, state.colorTemp))
    );
  if (state.hue !== undefined)
    body.hue = Math.max(0, Math.min(65535, state.hue));
  if (state.saturation !== undefined)
    body.sat = Math.round((Math.max(0, Math.min(100, state.saturation)) / 100) * 254);

  const response = await fetch(
    `http://${config.bridgeIp}/api/${config.username}/groups/${groupId}/action`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) throw new Error(`Hue API error: ${response.status}`);
}
