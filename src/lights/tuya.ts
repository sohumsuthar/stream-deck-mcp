import crypto from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".stream-deck-mcp");
const TUYA_CONFIG = join(CONFIG_DIR, "tuya-config.json");

const REGION_URLS: Record<string, string> = {
  us: "https://openapi.tuyaus.com",
  eu: "https://openapi.tuyaeu.com",
  cn: "https://openapi.tuyacn.com",
  in: "https://openapi.tuyain.com",
};

// Tuya requires accurate timestamps. Sync offset on first call.
let timeOffset = 0;
let timeSynced = false;

async function syncTime(region: string): Promise<void> {
  if (timeSynced) return;
  const baseUrl = getBaseUrl(region);
  // Make a dummy call to get the server time from the response
  const res = await fetch(`${baseUrl}/v1.0/token?grant_type=1`, {
    headers: { client_id: "probe", sign: "probe", t: "0", sign_method: "HMAC-SHA256" },
  });
  const data = (await res.json()) as { t?: number };
  if (data.t) {
    timeOffset = data.t - Date.now();
    timeSynced = true;
  }
}

function now(): string {
  return (Date.now() + timeOffset).toString();
}

export interface TuyaConfig {
  clientId: string;
  clientSecret: string;
  region: string;
  deviceIds: string[];
}

let cachedConfig: TuyaConfig | null = null;
let cachedToken: { access_token: string; expire_time: number } | null = null;

export async function loadConfig(): Promise<TuyaConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const raw = await readFile(TUYA_CONFIG, "utf-8");
    cachedConfig = JSON.parse(raw) as TuyaConfig;
    return cachedConfig;
  } catch {
    throw new Error(
      "Tuya not configured. Use tuya_configure to set credentials."
    );
  }
}

export async function saveConfig(config: TuyaConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(TUYA_CONFIG, JSON.stringify(config, null, 2));
  cachedConfig = config;
  cachedToken = null;
}

function getBaseUrl(region: string): string {
  return REGION_URLS[region] ?? REGION_URLS.us!;
}

function sign(
  clientId: string,
  secret: string,
  t: string,
  token: string,
  method: string,
  path: string,
  body: string
): string {
  const contentHash = crypto
    .createHash("sha256")
    .update(body || "")
    .digest("hex");
  const stringToSign = [method, contentHash, "", path].join("\n");
  const signStr = clientId + token + t + stringToSign;
  return crypto
    .createHmac("sha256", secret)
    .update(signStr)
    .digest("hex")
    .toUpperCase();
}

async function getToken(config: TuyaConfig): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expire_time) {
    return cachedToken.access_token;
  }

  await syncTime(config.region);
  const baseUrl = getBaseUrl(config.region);
  const path = "/v1.0/token?grant_type=1";
  const t = now();
  const signature = sign(
    config.clientId,
    config.clientSecret,
    t,
    "",
    "GET",
    path,
    ""
  );

  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      client_id: config.clientId,
      sign: signature,
      t,
      sign_method: "HMAC-SHA256",
    },
  });
  const data = (await res.json()) as {
    success: boolean;
    msg?: string;
    result: { access_token: string; expire_time: number };
  };
  if (!data.success) throw new Error(data.msg ?? "Failed to get Tuya token");

  cachedToken = {
    access_token: data.result.access_token,
    expire_time: Date.now() + (data.result.expire_time - 60) * 1000,
  };
  return cachedToken.access_token;
}

export async function tuyaGet(path: string): Promise<unknown> {
  const config = await loadConfig();
  const token = await getToken(config);
  const baseUrl = getBaseUrl(config.region);
  const t = now();
  const signature = sign(
    config.clientId,
    config.clientSecret,
    t,
    token,
    "GET",
    path,
    ""
  );

  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      client_id: config.clientId,
      access_token: token,
      sign: signature,
      t,
      sign_method: "HMAC-SHA256",
    },
  });
  const data = (await res.json()) as {
    success: boolean;
    msg?: string;
    result: unknown;
  };
  if (!data.success) throw new Error(data.msg ?? "Tuya API error");
  return data.result;
}

export async function tuyaPost(
  path: string,
  body: unknown = {}
): Promise<unknown> {
  const config = await loadConfig();
  const token = await getToken(config);
  const baseUrl = getBaseUrl(config.region);
  const t = now();
  const bodyStr = JSON.stringify(body);
  const signature = sign(
    config.clientId,
    config.clientSecret,
    t,
    token,
    "POST",
    path,
    bodyStr
  );

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      client_id: config.clientId,
      access_token: token,
      sign: signature,
      t,
      sign_method: "HMAC-SHA256",
      "Content-Type": "application/json",
    },
    body: bodyStr,
  });
  const data = (await res.json()) as {
    success: boolean;
    msg?: string;
    result: unknown;
  };
  if (!data.success) throw new Error(data.msg ?? "Tuya API error");
  return data.result;
}

// ── High-level helpers ──

export async function getDeviceIds(): Promise<string[]> {
  const config = await loadConfig();
  return config.deviceIds;
}

export interface DeviceStatus {
  id: string;
  name: string;
  online: boolean;
  on: boolean;
  brightness: number;
  colorTemp: number;
  workMode: string;
}

export async function getDeviceStatus(id: string): Promise<DeviceStatus> {
  const device = (await tuyaGet(`/v1.0/devices/${id}`)) as {
    id: string;
    name: string;
    online: boolean;
  };
  const status = (await tuyaGet(`/v1.0/devices/${id}/status`)) as {
    code: string;
    value: unknown;
  }[];
  const m: Record<string, unknown> = {};
  for (const s of status ?? []) m[s.code] = s.value;

  return {
    id: device.id,
    name: device.name ?? id,
    online: device.online,
    on: (m.switch_led ?? m.switch_1 ?? false) as boolean,
    brightness: Math.round(
      (((m.bright_value_v2 ?? m.bright_value ?? 10) as number) - 10) /
        990 *
        100
    ),
    colorTemp: Math.round(
      ((m.temp_value_v2 ?? m.temp_value ?? 0) as number) / 10
    ),
    workMode: (m.work_mode ?? "white") as string,
  };
}

export async function setSwitch(id: string, on: boolean): Promise<void> {
  await tuyaPost(`/v1.0/devices/${id}/commands`, {
    commands: [{ code: "switch_led", value: on }],
  });
}

export async function toggleSwitch(id: string): Promise<boolean> {
  const status = (await tuyaGet(`/v1.0/devices/${id}/status`)) as {
    code: string;
    value: unknown;
  }[];
  const current = status?.find(
    (s) => s.code === "switch_led" || s.code === "switch_1"
  );
  const newVal = !current?.value;
  await tuyaPost(`/v1.0/devices/${id}/commands`, {
    commands: [{ code: current?.code ?? "switch_led", value: newVal }],
  });
  return newVal;
}

async function getRawStatus(
  id: string
): Promise<Record<string, unknown>> {
  const status = (await tuyaGet(`/v1.0/devices/${id}/status`)) as {
    code: string;
    value: unknown;
  }[];
  const m: Record<string, unknown> = {};
  for (const s of status ?? []) m[s.code] = s.value;
  return m;
}

export async function setBrightness(
  id: string,
  percent: number
): Promise<void> {
  const m = await getRawStatus(id);
  const workMode = (m.work_mode ?? "white") as string;

  if (workMode === "colour") {
    const colorStr = (m.colour_data_v2 ?? '{"h":0,"s":0,"v":1000}') as string;
    const color = JSON.parse(colorStr);
    color.v = Math.max(10, Math.min(1000, Math.round((percent / 100) * 990 + 10)));
    await tuyaPost(`/v1.0/devices/${id}/commands`, {
      commands: [{ code: "colour_data_v2", value: JSON.stringify(color) }],
    });
  } else {
    const mapped = Math.max(
      10,
      Math.min(1000, Math.round((percent / 100) * 990 + 10))
    );
    await tuyaPost(`/v1.0/devices/${id}/commands`, {
      commands: [{ code: "bright_value_v2", value: mapped }],
    });
  }
}

export async function adjustBrightness(
  id: string,
  delta: number
): Promise<number> {
  const m = await getRawStatus(id);
  const workMode = (m.work_mode ?? "white") as string;

  if (workMode === "colour") {
    const colorStr = (m.colour_data_v2 ?? '{"h":0,"s":0,"v":1000}') as string;
    const color = JSON.parse(colorStr);
    color.v = Math.max(10, Math.min(1000, color.v + Math.round(delta * 10)));
    await tuyaPost(`/v1.0/devices/${id}/commands`, {
      commands: [{ code: "colour_data_v2", value: JSON.stringify(color) }],
    });
    return Math.round((color.v - 10) / 990 * 100);
  } else {
    const current = (m.bright_value_v2 ?? m.bright_value ?? 500) as number;
    const newVal = Math.max(10, Math.min(1000, current + Math.round(delta * 10)));
    await tuyaPost(`/v1.0/devices/${id}/commands`, {
      commands: [{ code: "bright_value_v2", value: newVal }],
    });
    return Math.round((newVal - 10) / 990 * 100);
  }
}

export async function setTemperature(
  id: string,
  percent: number
): Promise<void> {
  const mapped = Math.round((percent / 100) * 1000);
  await tuyaPost(`/v1.0/devices/${id}/commands`, {
    commands: [
      { code: "work_mode", value: "white" },
      { code: "temp_value_v2", value: mapped },
    ],
  });
}

export async function setColor(
  id: string,
  h: number,
  s: number,
  v: number
): Promise<void> {
  await tuyaPost(`/v1.0/devices/${id}/commands`, {
    commands: [
      { code: "work_mode", value: "colour" },
      {
        code: "colour_data_v2",
        value: JSON.stringify({ h, s, v }),
      },
    ],
  });
}

export async function allOn(): Promise<void> {
  const ids = await getDeviceIds();
  await Promise.all(ids.map((id) => setSwitch(id, true).catch(() => {})));
}

export async function allOff(): Promise<void> {
  const ids = await getDeviceIds();
  await Promise.all(ids.map((id) => setSwitch(id, false).catch(() => {})));
}
