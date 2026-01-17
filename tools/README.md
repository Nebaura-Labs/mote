# Clawd Tools for Mote

This folder contains clawd.bot tools for controlling Mote devices.

## Installation

1. Copy `mote-tool.ts` to your clawdbot installation:
   ```bash
   cp mote-tool.ts /path/to/clawdbot/src/agents/tools/
   ```

2. Register the tool in `clawdbot/src/agents/clawdbot-tools.ts`:
   ```typescript
   // Add import at the top
   import { createMoteTool } from "./tools/mote-tool.js";

   // Add to the tools array in createClawdbotTools()
   export function createClawdbotTools(options?: {...}): AnyAgentTool[] {
     return [
       // ... other tools
       createMoteTool(),  // Add this line
       // ... other tools
     ];
   }
   ```

3. Rebuild clawdbot:
   ```bash
   cd /path/to/clawdbot
   npm run build
   ```

4. If running with Docker, rebuild the image:
   ```bash
   docker build -t clawdbot .
   ```

5. Restart your Gateway to pick up the new tool:
   ```bash
   # If using Docker Compose
   docker-compose up -d --build

   # Or restart the container manually
   docker restart clawdbot
   ```

## Available Actions

### `list`
List all connected Mote devices.

### `wifi_scan`
Scan WiFi networks visible to the Mote device.

### `http`
Make HTTP requests to devices on Mote's local network.

Parameters:
- `url` (required): URL to request
- `method` (optional): GET, POST, PUT, DELETE (default: GET)
- `body` (optional): Request body for POST/PUT
- `headers` (optional): HTTP headers as key-value pairs

## Example Usage

Once installed, clawd can use the tool like this:

- "Scan WiFi networks" → `mote` tool with `action: wifi_scan`
- "List my Mote devices" → `mote` tool with `action: list`
- "Turn on lights at http://192.168.1.50/on" → `mote` tool with `action: http, url: ..., method: POST`

## Supported IoT Commands

The Mote firmware supports these commands via the tool:

| Command | Description |
|---------|-------------|
| `iot.http` | Make HTTP requests to any device on the local network |
| `wifi.scan` | Scan and list available WiFi networks |
| `iot.discover` | mDNS/SSDP discovery (coming soon) |
