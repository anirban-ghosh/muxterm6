# MuxTerm

A modern, cross-platform terminal emulator with tabs, split panes, tmux control mode integration, and a built-in SFTP browser.

Built with Electron, React, xterm.js, and node-pty.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-experimental-orange)

---

## Overview

MuxTerm is a terminal emulator that combines the features of several popular terminals into a single cross-platform application:

- **Full terminal emulation** with 256-color and truecolor support, WebGL-accelerated rendering, and correct handling of visual applications like vim, htop, and ncurses programs
- **Tabs and split panes** with mouse-resizable vertical and horizontal splits, nested to arbitrary depth
- **Tmux control mode (`tmux -CC`)** integration that maps tmux sessions to native windows, tmux windows to tabs, and tmux panes to split panes — enabling native scrolling, text selection, and copy/paste within tmux, both locally and over SSH
- **Built-in two-pane SFTP browser** with drag-and-drop transfers, rsync-based file operations with progress reporting, SSH config auto-discovery, and interactive authentication

### How it was built

Every line of code in this repository was AI-generated, guided and steered by a human operator. Development followed an iterative plan-implement-test cycle across multiple phases, starting from a blank directory. The prompts and plans used to guide development are preserved in the [`prds/`](prds/) directory.

### Limitations

- Windows support is not yet implemented (macOS and Linux only)
- Tmux control mode rendering has known edge cases with complex layouts
- The application has not been security-hardened (see [Disclaimer](#disclaimer))
- No settings UI — configuration is done through code

---

## Purpose and Disclaimer

### Motivation

This project was started to explore the limits of agentic engineering and as an experiment in agent-driven application generation (software-on-demand). All code in this repo is AI-generated, guided and steered by me. The goal was to start from a blank directory and generate a cross-platform, fully featured modern terminal emulator with tabs, split panes, tmux control mode integration (like iTerm2 on Mac), and a built-in SFTP browser.

### Why a terminal?

I wanted a terminal emulator app that had at minimum the following features:

- **Cross-platform** on Mac, Linux, and Windows — like Termius or Hyper
- **Multiple tabs and resizable split panes** (vertical and horizontal) — like Konsole, iTerm2, or Windows Terminal
- **A built-in SFTP browser** — like Termius or MobaXterm
- **Tmux control mode integration** to map tmux windows and panes to native tabs and panes, enabling native scrolling, selection, and copy — only iTerm2 has this, and it is available only on Mac

The above combined feature set does not exist in any single known solution, with the possible exception of WezTerm.

It seemed a challenging problem for AI-driven development:

- Only iTerm2 and WezTerm support `tmux -CC`. None of the other popular terminals (GNOME Terminal, Konsole, Alacritty, Kitty) support this
- A terminal requires system shell access and a graphical interface with correct rendering of incoming shell output. Tmux control mode further complicates this since the app must parse the tmux control mode protocol and redraw each pane's content while correctly mapping tmux sessions to windows, tmux windows to tabs, and tmux panes to split panes
- GUIs are still hard for AIs to auto-debug because aesthetic and usability bugs are harder to catch without screen recording and computer-use capabilities

### Extensibility

This project is designed to be extensible — features can be added independently. For example, the SFTP browser was developed as a standalone module with its own window, store, and IPC layer, completely independent of the terminal or tmux integration.

### Prior attempts

This is the sixth attempt starting from scratch (hence "muxterm6"). All previous attempts reached plateaus beyond which it was difficult to further debug, especially complex tmux control mode UI issues that are difficult for agents to see and debug without visual feedback.

### Disclaimer

**This is an experimental project meant for learning and exploration. The application has direct access to your system shell. It will have bugs and security vulnerabilities. The application has not been hardened. Do not use it for anything important, sensitive, or requiring security.**

---

## Installation

### Prerequisites

- **Node.js** 18+ ([nodejs.org](https://nodejs.org))
- **pnpm** ([pnpm.io](https://pnpm.io)) — `npm install -g pnpm`
- **tmux** (for tmux control mode) — `brew install tmux` (macOS) or `sudo apt install tmux` (Linux)
- **rsync** (for SFTP transfers) — pre-installed on macOS and most Linux distributions

### Quick start — using the app

```bash
# Clone the repository
git clone https://github.com/anirban-ghosh/muxterm6.git
cd muxterm6

# Install dependencies
pnpm install

# Build and run
pnpm build
pnpm start
```

### Quick start — development

```bash
# Install dependencies
pnpm install

# Start in development mode (hot reload)
pnpm dev

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build for production
pnpm build

# Package for distribution
pnpm dist
```

### Architecture

MuxTerm follows a standard Electron architecture with three process layers:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Main process** | Node.js, node-pty, ssh2-sftp-client | Shell management, SFTP connections, tmux protocol parsing |
| **Preload** | Electron contextBridge | Secure IPC bridge between main and renderer |
| **Renderer** | React 18, xterm.js, Zustand | UI rendering, terminal display, state management |

```
src/
  main/           # Electron main process
    tmux/          # Tmux control mode (protocol parser, session manager)
    sftp/          # SFTP services (connection manager, transfers, local files)
  preload/         # Context bridge APIs
  renderer/        # React UI
    components/
      Terminal/    # xterm.js terminal views
      SplitPane/   # Recursive split pane layout
      TabBar/      # Tab management
      SftpBrowser/ # Two-pane SFTP browser
    store/         # Zustand state (app store, tmux slice, SFTP store)
  shared/          # Types and IPC channel definitions
```

For a detailed architecture reference, see [docs/architecture.md](docs/architecture.md).

---

## Usage

### Windows, tabs, and panes

| Action | Shortcut |
|--------|----------|
| New window | `Cmd+N` |
| New tab | `Cmd+T` |
| Close tab/pane | `Cmd+W` |
| Next tab | `Cmd+Shift+]` |
| Previous tab | `Cmd+Shift+[` |
| Split vertically (side by side) | `Cmd+D` |
| Split horizontally (top/bottom) | `Cmd+Shift+D` |
| Select all | `Cmd+A` |

- **Resize panes** by dragging the divider between them with the mouse
- **Exiting the shell** (typing `exit` or `Ctrl+D`) closes the pane. Closing the last pane closes the tab. Closing the last tab closes the window.

### Tmux control mode

MuxTerm integrates with tmux control mode to provide a native UI for tmux sessions. This works both locally and over SSH.

**Starting a tmux session:**

```bash
# New local session
tmux -CC new -s mysession

# Attach to existing local session
tmux -CC attach -t mysession

# Over SSH
ssh myserver -t tmux -CC new -s remotesession
ssh myserver -t tmux -CC attach -t remotesession
```

**What happens on attach:**

1. A new MuxTerm window opens, mapped to the tmux session
2. Each tmux window appears as a tab
3. Each tmux pane appears as a split pane with correct layout and proportions
4. Existing scrollback history is loaded into each pane
5. The original (triggering) terminal shows a gateway overlay

**Gateway overlay controls:**

| Key | Action |
|-----|--------|
| `Esc` | Detach from tmux session (closes tmux window, returns to shell) |
| `X` | Force-quit the tmux session |

**In a tmux window:**

- `Cmd+T` creates a new tmux window (tab)
- `Cmd+D` / `Cmd+Shift+D` splits the current tmux pane
- `Cmd+W` closes (kills) the current tmux pane
- Dragging pane dividers resizes tmux panes (with a shadow preview divider)
- Native scrolling, text selection, and copy/paste work as expected
- Mouse-aware applications (vim, htop) work correctly

### SFTP browser

Open the SFTP browser from the menu: **Shell > SFTP Browser** (`Cmd+Shift+S`).

**Connecting:**

1. A two-pane window opens — local files on the left, remote on the right
2. Click **Connect** to open the connection dialog
3. Select a host from your `~/.ssh/config` or enter custom connection details
4. Authenticate via SSH key or password (prompts as needed)
5. Accept the host key fingerprint if connecting for the first time

**File operations:**

| Action | How |
|--------|-----|
| Navigate into directory | Double-click the directory |
| Go to parent directory | Double-click `..` |
| Open local file | Double-click a file in the local pane |
| Download remote file | Double-click a file in the remote pane |
| Move within a pane | Drag and drop to a directory |
| Transfer across panes | Drag and drop from one pane to the other |
| Cut / Copy / Paste | `Cmd+X` / `Cmd+C` / `Cmd+V` or right-click context menu |
| Delete | `Delete` / `Backspace` or right-click > Delete |
| Send to other pane | Right-click > Send to Remote/Local |
| Select multiple files | `Cmd+Click` or `Shift+Click` |
| Select all | `Cmd+A` |
| Sort files | Click column headers (Name, Size, Modified, Perms) |

- Transfers use rsync with progress reporting shown at the bottom of the window
- File conflicts prompt for Cancel, Overwrite, or Rename
- Hidden files are always shown
- Remote symlinks are resolved correctly

---

## Future features

- Continue fixing tmux control mode rendering edge cases
- Add a port forwarding manager (local, remote, and dynamic tunnels)
- Windows platform support
- Settings UI for themes, fonts, and keybindings
- SSH connection manager integrated with the terminal

---

## License

MIT License

Copyright (c) 2026 Anirban Ghosh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

**This is an experimental project. The application has direct access to your system shell. It will have bugs and security vulnerabilities. The application has not been hardened. Do not use it for anything important, sensitive, or requiring security. The author assumes no liability for any damages resulting from the use of this software.**
