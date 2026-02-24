#!/usr/bin/env node

/**
 * CLI tool for controlling Tuya smart lights from Stream Deck buttons.
 * Usage: node build/cli.js <command> [args]
 */

import * as tuya from "./lights/tuya.js";

const [command, ...args] = process.argv.slice(2);

async function forEachDevice(
  fn: (id: string) => Promise<void>
): Promise<void> {
  const ids = await tuya.getDeviceIds();
  for (const id of ids) {
    try {
      await fn(id);
    } catch (err) {
      console.error(`Error with ${id}: ${err}`);
    }
  }
}

try {
  switch (command) {
    case "on":
      await tuya.allOn();
      console.log("All lights ON");
      break;

    case "off":
      await tuya.allOff();
      console.log("All lights OFF");
      break;

    case "toggle":
      await forEachDevice(async (id) => {
        const newState = await tuya.toggleSwitch(id);
        console.log(`${id}: ${newState ? "ON" : "OFF"}`);
      });
      break;

    case "brightness": {
      const val = parseInt(args[0] ?? "50", 10);
      await forEachDevice(async (id) => {
        await tuya.setBrightness(id, val);
      });
      console.log(`Brightness: ${val}%`);
      break;
    }

    case "brightness-up":
      await forEachDevice(async (id) => {
        const status = await tuya.getDeviceStatus(id);
        const newBri = Math.min(100, status.brightness + 15);
        await tuya.setBrightness(id, newBri);
        console.log(`${status.name}: ${newBri}%`);
      });
      break;

    case "brightness-down":
      await forEachDevice(async (id) => {
        const status = await tuya.getDeviceStatus(id);
        const newBri = Math.max(5, status.brightness - 15);
        await tuya.setBrightness(id, newBri);
        console.log(`${status.name}: ${newBri}%`);
      });
      break;

    case "warmer":
      await forEachDevice(async (id) => {
        const status = await tuya.getDeviceStatus(id);
        const newTemp = Math.max(0, status.colorTemp - 15);
        await tuya.setTemperature(id, newTemp);
        console.log(`${status.name}: temp ${newTemp}% (warmer)`);
      });
      break;

    case "cooler":
      await forEachDevice(async (id) => {
        const status = await tuya.getDeviceStatus(id);
        const newTemp = Math.min(100, status.colorTemp + 15);
        await tuya.setTemperature(id, newTemp);
        console.log(`${status.name}: temp ${newTemp}% (cooler)`);
      });
      break;

    case "status":
      await forEachDevice(async (id) => {
        const s = await tuya.getDeviceStatus(id);
        console.log(JSON.stringify(s, null, 2));
      });
      break;

    default:
      console.log("Usage: node cli.js <command>");
      console.log(
        "Commands: on, off, toggle, brightness <0-100>, brightness-up,"
      );
      console.log("          brightness-down, warmer, cooler, status");
      break;
  }
} catch (err) {
  console.error(`Error: ${err}`);
  process.exit(1);
}
