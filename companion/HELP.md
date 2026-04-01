# RossVideo Serial Tally Listener - Bitfocus Companion Module

## Overview

This is a Bitfocus Companion module that listens for Serial Tally UMD (Under Monitor Display) tally data via UDP or TCP, making that data available as variables and feedbacks within the Bitfocus Companion application.

## Project Structure

- `index.js` - Main entry point; extends InstanceBase from @companion-module/base
- `src/` - Core module logic
  - `api.js` - Network communication (UDP/TCP) and Serial Tally parsing
  - `config.js` - Configuration fields (port, protocol, etc.)
  - `actions.js` - User-triggerable actions
  - `feedbacks.js` - Feedback triggers based on tally states
  - `variables.js` - Dynamic variables for tally labels and states
  - `presets.js` - Pre-defined button layouts
  - `upgrades.js` - Configuration migration scripts
- `companion/manifest.json` - Module metadata for Bitfocus Companion
- `companion/HELP.md` - End-user documentation
- `run.js` - Development runner that simulates the Companion IPC host

## Runtime

- **Language**: JavaScript (Node.js)
- **Package Manager**: Yarn (`yarn install --ignore-engines` due to Node 24 vs expected 18/22)
- **Dependencies**: `@companion-module/base` (runtime), `@companion-module/tools`, `prettier` (dev)

## Configuration

- Enter the listening port that Companion should use to listen for the incoming data.
- Select whether to listen via TCP or UDP.

## Actions

This module inherently has no actions. If you wish to perform an action based on a tally state change, use a Trigger.

## Variables

- Variable for each Address with UMD Label for value (address_label)
- Variable for each Address and Tally State (On/Off) (PVW, PGM)

## Feedbacks

- Set button to color if address `x` Tally `y` (1-4) is this state (On/Off)

## Presets

- Tally State Green/Red with Tally Label from Variable

## Architecture Notes

- The module supports Ross Vision for tally data
- Ross Vision protocol uses proprietary binary packets over UDP (port 9800):
  - 21-byte label packets (0xC1 header): address at byte 2, label at bytes 3-20
  - B1 status packets: size depends on MLE count — 74 + (N × 25) + 76 bytes (175/200/225 for 1-3 MLEs)
  - Each MLE occupies a 25-byte block starting at byte 74, in reverse MLE order (highest MLE first)
  - MLE block internal offsets: +0=KEY1 src, +3=KEY status bitmask, +4=KEY2 src, +8=KEY3 src, +12=KEY4 src, +16=PGM, +18=PVW
  - KEY status bitmask: bit4=KEY1, bit5=KEY2, bit6=KEY3, bit7=KEY4
  - Config: Number of MLEs (1-3), MLE Base Source Address (default 99, auto-calculates MLE_N = base + (N-1)*6), Main MLE selector
  - Cascading tally: Main MLE's PGM/PVW sources get direct tally; active KEY sources on Main MLE contribute to PGM tally; secondary MLEs cascade when their source address is on Main MLE's PGM/PVW (including their active KEY sources)
  - "Ross MLE Source Match" feedback compares MLE bus crosspoints against source addresses
  - TCP transport includes reassembly buffering with dynamic B1 packet size
- It opens UDP or TCP listeners on a configured port
- Discovered tallies are stored in `this.TALLIES` and exposed as Companion variables/feedbacks
- Ross Vision state is stored in `this.ROSS_MLE_STATE` (per-MLE: pgm, pvw, key1-4 sources, key1-4 active) and `this.ROSS_LABELS` (source labels by address)

