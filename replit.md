# TSL Products UMD Listener - Bitfocus Companion Module

## Overview

This is a Bitfocus Companion module that listens for TSL UMD (Under Monitor Display) tally data via UDP or TCP, making that data available as variables and feedbacks within the Bitfocus Companion application.

## Project Structure

- `index.js` - Main entry point; extends InstanceBase from @companion-module/base
- `src/` - Core module logic
  - `api.js` - Network communication (UDP/TCP) and TSL 3.1 / 5.0 packet parsing
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

## Workflow

The "Start application" workflow runs `node run.js` which:
1. Forks `index.js` as a child process with IPC enabled (as Companion does)
2. Mocks the Companion host registration handshake
3. Logs module activity to the console

This module is intended to run as a child process inside Bitfocus Companion using Node.js IPC. It cannot be run fully standalone, as it requires a Companion host to send configuration and process tally data.

## Architecture Notes

- The module uses TSL protocols 3.1 and 5.0 for tally data
- It opens UDP or TCP listeners on a configured port
- Discovered tallies are stored in `this.TALLIES` and exposed as Companion variables/feedbacks
