import { listStreamDecks, openStreamDeck } from "@elgato-stream-deck/node";
import type { StreamDeck } from "@elgato-stream-deck/node";

export interface DeviceInfo {
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  buttonCount: number;
  buttonColumns: number;
  buttonRows: number;
  iconSize: { width: number; height: number };
  path: string;
}

let activeDevice: StreamDeck | null = null;

export async function getDeviceList(): Promise<
  { path: string; model: string; serialNumber: string }[]
> {
  const devices = await listStreamDecks();
  return devices.map((d) => ({
    path: d.path,
    model: d.model.toString(),
    serialNumber: d.serialNumber ?? "unknown",
  }));
}

export async function getDevice(devicePath?: string): Promise<StreamDeck> {
  if (activeDevice) return activeDevice;

  if (devicePath) {
    activeDevice = await openStreamDeck(devicePath);
  } else {
    const devices = await listStreamDecks();
    if (devices.length === 0) {
      throw new Error(
        "No Stream Deck devices found. Make sure a device is connected and not in use by another application."
      );
    }
    activeDevice = await openStreamDeck(devices[0].path);
  }

  return activeDevice;
}

export async function getInfo(devicePath?: string): Promise<DeviceInfo> {
  const device = await getDevice(devicePath);
  const buttons = device.CONTROLS.filter((c) => c.type === "button");

  // Find pixel size from an LCD-feedback button, or default to 72x72
  let iconSize = { width: 72, height: 72 };
  for (const btn of buttons) {
    if (btn.feedbackType === "lcd") {
      iconSize = btn.pixelSize;
      break;
    }
  }

  // Compute columns/rows from button positions
  let maxCol = 0;
  let maxRow = 0;
  for (const btn of buttons) {
    if (btn.column > maxCol) maxCol = btn.column;
    if (btn.row > maxRow) maxRow = btn.row;
  }

  return {
    model: device.MODEL.toString(),
    serialNumber: (await device.getSerialNumber()) ?? "unknown",
    firmwareVersion: (await device.getFirmwareVersion()) ?? "unknown",
    buttonCount: buttons.length,
    buttonColumns: maxCol + 1,
    buttonRows: maxRow + 1,
    iconSize,
    path: device.PRODUCT_NAME ?? "unknown",
  };
}

export async function fillColor(
  buttonIndex: number,
  r: number,
  g: number,
  b: number,
  devicePath?: string
): Promise<void> {
  const device = await getDevice(devicePath);
  await device.fillKeyColor(buttonIndex, r, g, b);
}

export async function fillImage(
  buttonIndex: number,
  imageBuffer: Buffer,
  devicePath?: string
): Promise<void> {
  const device = await getDevice(devicePath);
  await device.fillKeyBuffer(buttonIndex, imageBuffer);
}

export async function clearKey(
  buttonIndex: number,
  devicePath?: string
): Promise<void> {
  const device = await getDevice(devicePath);
  await device.clearKey(buttonIndex);
}

export async function clearPanel(devicePath?: string): Promise<void> {
  const device = await getDevice(devicePath);
  await device.clearPanel();
}

export async function setBrightness(
  percent: number,
  devicePath?: string
): Promise<void> {
  const device = await getDevice(devicePath);
  await device.setBrightness(Math.max(0, Math.min(100, percent)));
}

export function closeDevice(): void {
  if (activeDevice) {
    activeDevice.close().catch(() => {});
    activeDevice = null;
  }
}

process.on("exit", closeDevice);
process.on("SIGINT", () => {
  closeDevice();
  process.exit(0);
});
process.on("SIGTERM", () => {
  closeDevice();
  process.exit(0);
});
