import { Bonjour, type Service } from "bonjour-service";

export interface KeyLightInfo {
  name: string;
  ip: string;
  port: number;
}

export interface KeyLightState {
  on: boolean;
  brightness: number;
  temperature: number;
}

const discoveredLights: Map<string, KeyLightInfo> = new Map();

export async function discoverKeyLights(
  timeoutMs = 5000
): Promise<KeyLightInfo[]> {
  return new Promise((resolve) => {
    const bonjour = new Bonjour();
    const found: KeyLightInfo[] = [];

    const browser = bonjour.find({ type: "elg" }, (service: Service) => {
      const addresses = service.addresses ?? [];
      const ip = addresses[0] ?? "";
      const info: KeyLightInfo = {
        name: service.name,
        ip,
        port: service.port,
      };
      if (info.ip) {
        found.push(info);
        discoveredLights.set(info.name, info);
      }
    });

    setTimeout(() => {
      browser.stop();
      bonjour.destroy();
      // Return cached + newly found
      resolve(
        found.length > 0 ? found : Array.from(discoveredLights.values())
      );
    }, timeoutMs);
  });
}

export function getCachedLights(): KeyLightInfo[] {
  return Array.from(discoveredLights.values());
}

export async function getKeyLightStatus(
  ip: string,
  port = 9123
): Promise<KeyLightState> {
  const response = await fetch(`http://${ip}:${port}/elgato/lights`);
  if (!response.ok)
    throw new Error(`Key Light API error: ${response.status}`);
  const data = (await response.json()) as {
    lights: { on: number; brightness: number; temperature: number }[];
  };
  const light = data.lights[0];
  if (!light) throw new Error("No light data in response");

  return {
    on: light.on === 1,
    brightness: light.brightness,
    // Convert from mired to kelvin: temperature field is in mired (143-344 range)
    temperature: Math.round(1000000 / light.temperature),
  };
}

export async function setKeyLight(
  ip: string,
  options: {
    on?: boolean;
    brightness?: number;
    temperature?: number;
  },
  port = 9123
): Promise<KeyLightState> {
  const body: { lights: Record<string, number>[] } = {
    lights: [{}],
  };
  const light = body.lights[0]!;

  if (options.on !== undefined) {
    light.on = options.on ? 1 : 0;
  }
  if (options.brightness !== undefined) {
    light.brightness = Math.max(0, Math.min(100, options.brightness));
  }
  if (options.temperature !== undefined) {
    // Convert kelvin to mired
    light.temperature = Math.round(
      1000000 / Math.max(2900, Math.min(7000, options.temperature))
    );
  }

  const response = await fetch(`http://${ip}:${port}/elgato/lights`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(`Key Light API error: ${response.status}`);

  return getKeyLightStatus(ip, port);
}

export async function toggleKeyLight(
  ip: string,
  port = 9123
): Promise<KeyLightState> {
  const status = await getKeyLightStatus(ip, port);
  return setKeyLight(ip, { on: !status.on }, port);
}
