# stream-deck-mcp

An MCP (Model Context Protocol) server that gives Claude full control over your Elgato Stream Deck hardware, Elgato Key Lights, and Philips Hue lights.

## Features

### Stream Deck Control (8 tools)
- **streamdeck_list_devices** — List connected Stream Deck devices
- **streamdeck_get_info** — Get device info (model, serial, button count, icon size)
- **streamdeck_set_brightness** — Set device brightness (0–100%)
- **streamdeck_set_button_color** — Fill a button with an RGB color
- **streamdeck_set_button_image** — Set a button image from URL or base64
- **streamdeck_set_button_text** — Render text on a button
- **streamdeck_clear_button** — Clear a specific button
- **streamdeck_clear_all** — Clear all buttons

### Elgato Key Light Control (4 tools)
- **keylight_discover** — Discover Key Lights on your network via mDNS
- **keylight_get_status** — Get light status (on/off, brightness, color temperature)
- **keylight_set** — Set light properties (on/off, brightness 0–100%, temperature 2900–7000K)
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
- A Stream Deck connected via USB (for Stream Deck tools)
- Elgato Key Lights on the same network (for Key Light tools)
- Philips Hue Bridge on the same network (for Hue tools)

> **Note:** On Linux, you may need to set up udev rules for USB HID access to the Stream Deck. See [@elgato-stream-deck/node](https://github.com/Julusian/node-elgato-stream-deck) for details.

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/stream-deck-mcp.git
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

Then restart Claude Desktop. You can now ask Claude things like:

- "List my Stream Deck devices"
- "Set button 0 to red"
- "Write 'LIVE' on button 3"
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

## Development

```bash
# Run in development mode (with tsx)
npm run dev

# Build
npm run build

# Run built version
npm start
```

## Philips Hue Setup

The first time you use Hue tools:

1. Call `hue_discover_bridge` to find your bridge
2. Press the physical button on your Hue Bridge
3. Call `hue_pair` with the bridge IP within 30 seconds

Credentials are saved to `~/.stream-deck-mcp/hue-config.json` so you only need to pair once.

## License

MIT
