import { readdir, readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const APPDATA = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
const SD_BASE = join(APPDATA, "Elgato", "StreamDeck");
const PROFILES_V3 = join(SD_BASE, "ProfilesV3");
const PROFILES_V2 = join(SD_BASE, "ProfilesV2");

// ── Types ──

interface DeviceManifest {
  Device: { Model: string; UUID: string };
  Name: string;
  Pages: {
    Current: string;
    Default: string;
    Pages: string[];
  };
  Version: string;
  AppIdentifier?: string;
}

interface ActionState {
  Image?: string;
  FontFamily?: string;
  FontSize?: string;
  FontStyle?: string;
  FontUnderline?: boolean;
  OutlineThickness?: number;
  ShowTitle?: boolean;
  Title?: string;
  TitleAlignment?: string;
  TitleColor?: string;
}

interface ActionConfig {
  ActionID: string;
  LinkedTitle?: boolean;
  Name: string;
  UUID: string;
  Plugin?: { Name: string; UUID: string; Version: string };
  Resources?: unknown;
  Settings: Record<string, unknown>;
  State: number;
  States: ActionState[];
}

interface PageManifest {
  Controllers: {
    Type: string;
    Actions: Record<string, ActionConfig> | null;
    Icon?: string;
    Name?: string;
  }[];
}

// ── Public types ──

export interface ProfileInfo {
  id: string;
  name: string;
  deviceModel: string;
  deviceUUID: string;
  currentPage: string;
  pages: string[];
  path: string;
}

export interface ButtonInfo {
  row: number;
  col: number;
  position: string;
  actionType: string;
  name: string;
  title: string;
  settings: Record<string, unknown>;
}

// ── Profile discovery ──

async function getProfilesDir(): Promise<string> {
  // Prefer V3, fall back to V2
  try {
    await readdir(PROFILES_V3);
    return PROFILES_V3;
  } catch {
    return PROFILES_V2;
  }
}

export async function listProfiles(): Promise<ProfileInfo[]> {
  const profiles: ProfileInfo[] = [];
  const profilesDir = await getProfilesDir();

  let entries: string[];
  try {
    entries = await readdir(profilesDir);
  } catch {
    return profiles;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".sdProfile")) continue;
    const profileDir = join(profilesDir, entry);
    try {
      const raw = await readFile(join(profileDir, "manifest.json"), "utf-8");
      const manifest = JSON.parse(raw) as DeviceManifest;
      profiles.push({
        id: entry.replace(".sdProfile", ""),
        name: manifest.Name,
        deviceModel: manifest.Device.Model,
        deviceUUID: manifest.Device.UUID,
        currentPage: manifest.Pages.Current,
        pages: manifest.Pages.Pages,
        path: profileDir,
      });
    } catch {
      // skip malformed profiles
    }
  }

  return profiles;
}

export async function getDefaultProfile(): Promise<ProfileInfo> {
  const profiles = await listProfiles();
  if (profiles.length === 0) {
    throw new Error(
      "No Stream Deck profiles found. Is the Stream Deck software installed?"
    );
  }
  // Return the first non-app-specific profile, or just the first one
  return profiles[0]!;
}

// ── Page/layout reading ──

async function resolvePageDir(
  profilePath: string,
  pageId: string
): Promise<string> {
  // Try exact match first, then uppercase (V3 uses uppercase UUIDs)
  const profilesDir = join(profilePath, "Profiles");
  const candidates = [pageId, pageId.toUpperCase()];
  for (const candidate of candidates) {
    try {
      const dir = join(profilesDir, candidate);
      await readFile(join(dir, "manifest.json"), "utf-8");
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error(
    `Page ${pageId} not found in profile. Available pages can be seen via streamdeck_list_profiles.`
  );
}

async function readPageManifest(
  profilePath: string,
  pageId: string
): Promise<PageManifest> {
  const resolved = await resolvePageDir(profilePath, pageId);
  const manifestPath = join(profilePath, "Profiles", resolved, "manifest.json");
  const raw = await readFile(manifestPath, "utf-8");
  return JSON.parse(raw) as PageManifest;
}

async function writePageManifest(
  profilePath: string,
  pageId: string,
  manifest: PageManifest
): Promise<void> {
  // Resolve to the actual directory name (may be uppercase)
  let resolved: string;
  try {
    resolved = await resolvePageDir(profilePath, pageId);
  } catch {
    // New page - use uppercase UUID convention
    resolved = pageId.toUpperCase();
  }
  const dir = join(profilePath, "Profiles", resolved);
  await mkdir(dir, { recursive: true });
  const manifestPath = join(dir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

export async function getLayout(
  profileId?: string,
  pageId?: string
): Promise<{ profile: string; page: string; buttons: ButtonInfo[] }> {
  const profile = profileId
    ? (await listProfiles()).find((p) => p.id === profileId)
    : await getDefaultProfile();

  if (!profile) throw new Error(`Profile not found: ${profileId}`);

  const targetPage = pageId ?? profile.currentPage;
  const manifest = await readPageManifest(profile.path, targetPage);

  const buttons: ButtonInfo[] = [];
  for (const controller of manifest.Controllers) {
    if (controller.Type !== "Keypad" || !controller.Actions) continue;
    for (const [pos, action] of Object.entries(controller.Actions)) {
      const [rowStr, colStr] = pos.split(",");
      buttons.push({
        row: parseInt(rowStr ?? "0", 10),
        col: parseInt(colStr ?? "0", 10),
        position: pos,
        actionType: action.UUID,
        name: action.Name,
        title: action.States?.[0]?.Title ?? "",
        settings: action.Settings,
      });
    }
  }

  buttons.sort((a, b) => a.row - b.row || a.col - b.col);

  return {
    profile: profile.name,
    page: targetPage,
    buttons,
  };
}

// ── Action creation helpers ──

// Plugin UUID mapping for V3 format
const PLUGIN_MAP: Record<string, { Name: string; UUID: string; Version: string }> = {
  "com.elgato.streamdeck.system.hotkey": {
    Name: "Activate a Key Command",
    UUID: "com.elgato.streamdeck.system.hotkey",
    Version: "1.0",
  },
  "com.elgato.streamdeck.system.website": {
    Name: "Website",
    UUID: "com.elgato.streamdeck.system.website",
    Version: "1.0",
  },
  "com.elgato.streamdeck.system.open": {
    Name: "Open",
    UUID: "com.elgato.streamdeck.system.open",
    Version: "1.0",
  },
  "com.elgato.streamdeck.system.text": {
    Name: "Text",
    UUID: "com.elgato.streamdeck.system.text",
    Version: "1.0",
  },
  "com.elgato.streamdeck.system.multimedia": {
    Name: "Multimedia",
    UUID: "com.elgato.streamdeck.system.multimedia",
    Version: "1.0",
  },
};

function makeAction(
  uuid: string,
  name: string,
  settings: Record<string, unknown>,
  title?: string,
  titleColor?: string
): ActionConfig {
  return {
    ActionID: randomUUID(),
    LinkedTitle: !title,
    Name: name,
    Plugin: PLUGIN_MAP[uuid],
    Resources: null,
    UUID: uuid,
    Settings: settings,
    State: 0,
    States: [
      {
        FontFamily: "",
        FontSize: "12",
        FontStyle: "",
        FontUnderline: false,
        OutlineThickness: 2,
        ShowTitle: true,
        Title: title ?? "",
        TitleAlignment: "bottom",
        TitleColor: titleColor ?? "#ffffff",
      },
    ],
  };
}

// ── Add actions to buttons ──

async function setButtonAction(
  row: number,
  col: number,
  action: ActionConfig,
  profileId?: string,
  pageId?: string
): Promise<void> {
  const profile = profileId
    ? (await listProfiles()).find((p) => p.id === profileId)
    : await getDefaultProfile();

  if (!profile) throw new Error(`Profile not found: ${profileId}`);

  const targetPage = pageId ?? profile.currentPage;
  const manifest = await readPageManifest(profile.path, targetPage);

  // Find or create the Keypad controller
  let keypad = manifest.Controllers.find((c) => c.Type === "Keypad");
  if (!keypad) {
    keypad = { Type: "Keypad", Actions: {} };
    manifest.Controllers.push(keypad);
  }
  if (!keypad.Actions) {
    keypad.Actions = {};
  }

  const position = `${row},${col}`;
  keypad.Actions[position] = action;

  await writePageManifest(profile.path, targetPage, manifest);
}

export async function addHotkey(
  row: number,
  col: number,
  keys: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    win?: boolean;
    key: string;
    vKeyCode: number;
  },
  title?: string,
  profileId?: string,
  pageId?: string
): Promise<void> {
  const action = makeAction(
    "com.elgato.streamdeck.system.hotkey",
    "Hotkey",
    {
      Coalesce: true,
      Hotkeys: [
        {
          KeyCtrl: keys.ctrl ?? false,
          KeyShift: keys.shift ?? false,
          KeyOption: keys.alt ?? false,
          KeyCmd: keys.win ?? false,
          KeyModifiers:
            (keys.ctrl ? 4 : 0) |
            (keys.shift ? 2 : 0) |
            (keys.alt ? 1 : 0) |
            (keys.win ? 8 : 0),
          NativeCode: keys.vKeyCode,
          QTKeyCode: keys.vKeyCode,
          VKeyCode: keys.vKeyCode,
        },
      ],
    },
    title
  );
  await setButtonAction(row, col, action, profileId, pageId);
}

export async function addWebsite(
  row: number,
  col: number,
  url: string,
  title?: string,
  profileId?: string,
  pageId?: string
): Promise<void> {
  const action = makeAction(
    "com.elgato.streamdeck.system.website",
    "Website",
    {
      openInBrowser: true,
      path: url,
    },
    title
  );
  await setButtonAction(row, col, action, profileId, pageId);
}

export async function addAppLaunch(
  row: number,
  col: number,
  appPath: string,
  title?: string,
  profileId?: string,
  pageId?: string
): Promise<void> {
  const action = makeAction(
    "com.elgato.streamdeck.system.open",
    "Open",
    {
      path: appPath,
    },
    title
  );
  await setButtonAction(row, col, action, profileId, pageId);
}

export async function addText(
  row: number,
  col: number,
  text: string,
  sendEnter?: boolean,
  title?: string,
  profileId?: string,
  pageId?: string
): Promise<void> {
  const action = makeAction(
    "com.elgato.streamdeck.system.text",
    "Text",
    {
      pastedText: text,
      isSendingEnter: sendEnter ?? false,
    },
    title
  );
  await setButtonAction(row, col, action, profileId, pageId);
}

export async function addMultimedia(
  row: number,
  col: number,
  mediaAction: "play_pause" | "next" | "previous" | "volume_up" | "volume_down" | "mute",
  title?: string,
  profileId?: string,
  pageId?: string
): Promise<void> {
  // Media keys use hotkey actions with specific VKeyCodes
  const mediaKeyMap: Record<string, { vKeyCode: number; name: string }> = {
    play_pause: { vKeyCode: 179, name: "Play/Pause" },
    next: { vKeyCode: 176, name: "Next Track" },
    previous: { vKeyCode: 177, name: "Previous Track" },
    volume_up: { vKeyCode: 175, name: "Volume Up" },
    volume_down: { vKeyCode: 174, name: "Volume Down" },
    mute: { vKeyCode: 173, name: "Mute" },
  };

  const mk = mediaKeyMap[mediaAction];
  if (!mk) throw new Error(`Unknown media action: ${mediaAction}`);

  const action = makeAction(
    "com.elgato.streamdeck.system.hotkey",
    mk.name,
    {
      Coalesce: true,
      Hotkeys: [
        {
          KeyCtrl: false,
          KeyShift: false,
          KeyOption: false,
          KeyCmd: false,
          KeyModifiers: 0,
          NativeCode: mk.vKeyCode,
          QTKeyCode: mk.vKeyCode,
          VKeyCode: mk.vKeyCode,
        },
      ],
    },
    title ?? mk.name
  );
  await setButtonAction(row, col, action, profileId, pageId);
}

// ── Remove action ──

export async function removeAction(
  row: number,
  col: number,
  profileId?: string,
  pageId?: string
): Promise<void> {
  const profile = profileId
    ? (await listProfiles()).find((p) => p.id === profileId)
    : await getDefaultProfile();

  if (!profile) throw new Error(`Profile not found: ${profileId}`);

  const targetPage = pageId ?? profile.currentPage;
  const manifest = await readPageManifest(profile.path, targetPage);

  const keypad = manifest.Controllers.find((c) => c.Type === "Keypad");
  if (!keypad || !keypad.Actions) return;

  const position = `${row},${col}`;
  delete keypad.Actions[position];

  await writePageManifest(profile.path, targetPage, manifest);
}

// ── Update button title ──

export async function setButtonTitle(
  row: number,
  col: number,
  title: string,
  titleColor?: string,
  profileId?: string,
  pageId?: string
): Promise<void> {
  const profile = profileId
    ? (await listProfiles()).find((p) => p.id === profileId)
    : await getDefaultProfile();

  if (!profile) throw new Error(`Profile not found: ${profileId}`);

  const targetPage = pageId ?? profile.currentPage;
  const manifest = await readPageManifest(profile.path, targetPage);

  const keypad = manifest.Controllers.find((c) => c.Type === "Keypad");
  if (!keypad || !keypad.Actions) throw new Error("No keypad controller found");

  const position = `${row},${col}`;
  const action = keypad.Actions[position];
  if (!action) throw new Error(`No action at position ${position}`);

  action.LinkedTitle = false;
  if (action.States[0]) {
    action.States[0].Title = title;
    action.States[0].ShowTitle = true;
    if (titleColor) action.States[0].TitleColor = titleColor;
  }

  await writePageManifest(profile.path, targetPage, manifest);
}

// ── Reload Stream Deck software ──

export async function reloadStreamDeck(): Promise<string> {
  try {
    // Kill the Stream Deck process
    await execAsync('taskkill /IM "StreamDeck.exe" /F').catch(() => {});
    // Wait a moment
    await new Promise((r) => setTimeout(r, 1500));
    // Restart it
    const sdPath = join(
      process.env.ProgramFiles ?? "C:\\Program Files",
      "Elgato",
      "StreamDeck",
      "StreamDeck.exe"
    );
    // Try common install locations
    const paths = [
      sdPath,
      join(
        process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
        "Elgato",
        "StreamDeck",
        "StreamDeck.exe"
      ),
    ];
    for (const p of paths) {
      try {
        exec(`"${p}"`);
        return `Stream Deck software restarted from ${p}`;
      } catch {
        continue;
      }
    }
    return "Stream Deck process killed. Please restart it manually to apply changes.";
  } catch (error) {
    return `Could not restart Stream Deck: ${error}. Please restart it manually.`;
  }
}
