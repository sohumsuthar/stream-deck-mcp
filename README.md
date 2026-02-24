# stream-deck-mcp

An MCP (Model Context Protocol) server that lets Claude interactively manage your Elgato Stream Deck buttons, Elgato Key Lights, and Philips Hue lights.

## Features

### Stream Deck Profile Management (10 tools)
- **streamdeck_list_profiles** — List all configured profiles
- **streamdeck_get_layout** — See what's on every button (actions, titles, settings)
- **streamdeck_add_hotkey** — Assign a keyboard shortcut to a button
- **streamdeck_add_website** — Assign a URL to open when a button is pressed
- **streamdeck_add_app** — Assign an app launcher to a button
- **streamdeck_add_text** — Assign a text paste action to a button
- **streamdeck_add_multimedia** — Add media controls (play/pause, next, volume, mute)
- **streamdeck_remove_action** — Remove an action from a button
- **streamdeck_set_title** — Change a button's display title and color
- **streamdeck_reload** — Restart Stream Deck software to apply changes

### Elgato Key Light Control (4 tools)
- **keylight_discover** — Discover Key Lights on your network via mDNS
- **keylight_get_status** — Get light status (on/off, brightness, color temperature)
- **keylight_set** — Set light properties (on/off, brightness, temperature)
- **keylight_toggle** — Toggle a light on/off

### Philips Hue Control (6 tools)
- **hue_discover_bridge** — Find Hue Bridges on your network
- **hue_pair** — Pair with a bridge (press the button first!)
- **hue_list_lights** — List all lights with current state
- **hue_set_light** — Control individual lights (on/off, brightness, color, temperature)
- **hue_list_groups** — List rooms/groups
- **hue_set_group** — Control a group of lights

## Prerequisites

- Node.js 20+
- Elgato Stream Deck software installed (for Stream Deck profile tools)
- Elgato Key Lights on the same network (for Key Light tools)
- Philips Hue Bridge on the same network (for Hue tools)

## Installation

```bash
git clone https://github.com/sohumsuthar/stream-deck-mcp.git
cd stream-deck-mcp
npm install
npm run build
```

## Usage with Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "stream-deck": {
      "command": "node",
      "args": ["/absolute/path/to/stream-deck-mcp/build/index.js"]
    }
  }
}
```

Then restart Claude Desktop. You can ask Claude things like:

- "Show me what's on my Stream Deck right now"
- "Add a hotkey for Ctrl+Shift+M on button [0,2]"
- "Put a website shortcut to GitHub on the top-right button"
- "Add a play/pause button and a volume mute button"
- "Remove the action on button [1,0]"
- "Discover my Key Lights and set them to 50% brightness"
- "Turn off all the lights in the living room"

## Usage with Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "stream-deck": {
      "command": "node",
      "args": ["/absolute/path/to/stream-deck-mcp/build/index.js"]
    }
  }
}
```

## How It Works

The Stream Deck tools read and write the profile configuration files used by the Elgato Stream Deck software (stored in `%APPDATA%\Elgato\StreamDeck\ProfilesV2\`). After making changes, use `streamdeck_reload` to restart the Stream Deck software and apply them.

### Button Coordinates

Buttons are addressed by `[row, col]` starting from `[0,0]` at the top-left:

```
[0,0] [0,1] [0,2] [0,3] [0,4]
[1,0] [1,1] [1,2] [1,3] [1,4]
[2,0] [2,1] [2,2] [2,3] [2,4]
```

## Philips Hue Setup

First-time setup:

1. Call `hue_discover_bridge` to find your bridge
2. Press the physical button on your Hue Bridge
3. Call `hue_pair` with the bridge IP within 30 seconds

Credentials are saved to `~/.stream-deck-mcp/hue-config.json` so you only need to pair once.

## Development

```bash
npm run dev    # Run with tsx (hot reload)
npm run build  # Compile TypeScript
npm start      # Run compiled version
```

## License

MIT
