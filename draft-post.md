---
date: '2026-02-26T00:00:00.000Z'
title: Stream Deck MCP
tagline: AI-controlled Stream Deck with live camera clipping and smart lights
preview: >-
  An MCP server that turns a Stream Deck into an AI-controllable command center.
  Claude can manage buttons, control Tuya smart lights, and clip 1080p 60fps
  video from a DJI Osmo Action 5 Pro with a rolling 90-second buffer.
image: >-
  https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80
draft: true
---

# Stream Deck MCP

An MCP (Model Context Protocol) server that lets Claude manage an Elgato Stream Deck, control Tuya smart lights, and clip video from a DJI Osmo Action 5 Pro webcam — all through natural language.

## What it does

The project has three main systems that work together through a persistent HTTP server on port 7891:

**Stream Deck profile management** — Read and write Stream Deck button layouts directly through the V3 profile format. Assign hotkeys, app launchers, websites, or media controls to any button position. Claude can rearrange your entire layout from a single prompt.

**Tuya smart light control** — Toggle, dim, change color, and adjust color temperature on Tuya-connected lights. The server maintains a local state cache so every button press is near-instant — no round-trip to the Tuya Cloud API before each command.

**Camera clip buffer** — Continuously records from the Osmo Action 5 Pro at 1080p 60fps using ffmpeg's segment muxer. Nine rolling 10-second segments give a ~90 second circular video buffer. Press a button and the last 90 seconds get concatenated into a single MP4 using NVENC GPU encoding. A companion DJI Mic Bridge service buffers audio in parallel, so one press saves both video and audio.

## Stream Deck plugin

I built a custom Stream Deck plugin (`com.sohum.clipper`) that polls the server every 4 seconds and renders button state in real-time:

- **Red circle** — server offline
- **Green circle with progress ring** — buffer filling, shows seconds
- **"READY"** — full 90s buffer, ready to clip
- **Yellow** — saving clip in progress

When you press the button while the server is off, it auto-launches the server via a silent VBScript and starts polling until the buffer is live. No manual setup needed after a reboot.

There's a matching DJI Mic Bridge plugin that shows the same status pattern for the audio buffer.

## Architecture

```
Stream Deck button press
    → Clipper plugin (WebSocket to SD, HTTP to server)
    → HTTP server (port 7891)
        → ffmpeg segment muxer (rolling video buffer)
        → ffmpeg concat (clip to MP4)
    → Mic Bridge service (port 9090)
        → sounddevice circular buffer (rolling audio)
        → FLAC clip export
```

The server auto-starts both the camera buffer and the mic service on boot. Everything runs locally — no cloud dependencies for clipping.

## Tech stack

- **Server**: Node.js + TypeScript, raw HTTP (no framework)
- **Video**: ffmpeg with NVENC h264 encoding, segment muxer for rolling buffer
- **Audio**: Python + Flask + sounddevice, circular buffer with FLAC export
- **Lights**: Tuya Cloud API with HMAC-SHA256 signed requests
- **Stream Deck**: SDK v2 plugin with WebSocket + canvas-rendered dynamic icons
- **MCP**: Model Context Protocol for Claude integration

## The workflow

I have a 15-button Stream Deck. Page 1 has Discord controls, media keys, volume, ShadowPlay, and the clip buttons. Page 2 has light controls — toggle, brightness presets, warmer/cooler. Page 3 has color presets.

The clip buttons are the ones I use most. I'm recording gameplay or working at my desk, something interesting happens, I hit the button, and I have 90 seconds of 1080p 60fps video plus a separate mic audio track saved instantly. No need to have OBS running or remember to start recording.

The whole thing was built iteratively with Claude Code over a few sessions. The MCP integration means I can also ask Claude to rearrange buttons, adjust light scenes, or check buffer status through conversation.

## Source

The full source including both Stream Deck plugins is on [GitHub](https://github.com/sohumsuthar/stream-deck-mcp).
