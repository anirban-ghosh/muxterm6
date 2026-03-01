# MuxTerm Architecture

This document describes the architecture of MuxTerm — a terminal emulator built with Electron, React, xterm.js, and node-pty. It covers every subsystem in detail: process model, IPC communication, state management, the tmux control mode integration, and the SFTP browser.

---

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [Process Model](#process-model)
- [Directory Structure](#directory-structure)
- [Build System](#build-system)
- [Main Process](#main-process)
  - [Entry Point](#entry-point)
  - [Window Manager](#window-manager)
  - [PTY Manager](#pty-manager)
  - [IPC Handlers](#ipc-handlers)
  - [Application Menu](#application-menu)
  - [Shell Resolver](#shell-resolver)
  - [Logger](#logger)
- [Preload Layer](#preload-layer)
- [Renderer Process](#renderer-process)
  - [App Component and Routing](#app-component-and-routing)
  - [State Management (Zustand)](#state-management-zustand)
  - [Terminal Rendering](#terminal-rendering)
  - [Split Pane System](#split-pane-system)
  - [Tab Bar](#tab-bar)
  - [Theming](#theming)
- [Tmux Control Mode](#tmux-control-mode)
  - [Overview](#tmux-overview)
  - [DCS Detection and Session Lifecycle](#dcs-detection-and-session-lifecycle)
  - [Protocol Parser](#protocol-parser)
  - [Command Queue](#command-queue)
  - [Session Orchestrator](#session-orchestrator)
  - [Layout Parser](#layout-parser)
  - [Escape Encoding](#escape-encoding)
  - [Renderer Integration](#tmux-renderer-integration)
  - [Resize System](#resize-system)
- [SFTP Browser](#sftp-browser)
  - [SFTP Overview](#sftp-overview)
  - [Connection Manager](#connection-manager)
  - [Transfer Service](#transfer-service)
  - [Local File Service](#local-file-service)
  - [SSH Config Parser](#ssh-config-parser)
  - [SFTP IPC Handlers](#sftp-ipc-handlers)
  - [Renderer Components](#sftp-renderer-components)
  - [SFTP Store](#sftp-store)
- [IPC Channel Reference](#ipc-channel-reference)
- [Data Flow Diagrams](#data-flow-diagrams)
  - [Normal Terminal Keystroke Flow](#normal-terminal-keystroke-flow)
  - [Tmux Control Mode Attach Flow](#tmux-control-mode-attach-flow)
  - [SFTP Connect and Browse Flow](#sftp-connect-and-browse-flow)
- [Shared Types](#shared-types)
- [Testing](#testing)
- [CSS and Styling](#css-and-styling)

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron App                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Main Process                           │   │
│  │                                                           │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │   │
│  │  │ PTY      │  │ Window   │  │ Tmux Subsystem       │   │   │
│  │  │ Manager  │  │ Manager  │  │  ┌─────────────────┐ │   │   │
│  │  │ (node-   │  │          │  │  │ Protocol Parser │ │   │   │
│  │  │  pty)    │  │ Terminal │  │  │ Command Queue   │ │   │   │
│  │  │          │  │ Tmux     │  │  │ Session         │ │   │   │
│  │  │          │  │ SFTP     │  │  │ Layout Parser   │ │   │   │
│  │  └──────────┘  └──────────┘  │  └─────────────────┘ │   │   │
│  │                               └──────────────────────┘   │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │ SFTP Subsystem                                    │    │   │
│  │  │  Connection Manager │ Transfer Service │ Local FS │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │ IPC (contextBridge)                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Preload Script                          │   │
│  │         terminalAPI (window.terminalAPI)                  │   │
│  │         sftpAPI     (window.sftpAPI)                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Renderer Process                         │   │
│  │                                                           │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ React 18 + Zustand Store                            │  │   │
│  │  │                                                     │  │   │
│  │  │  App.tsx ─┬─ TitleBar + TabBar                     │  │   │
│  │  │           ├─ SplitContainer (recursive)            │  │   │
│  │  │           │   └─ TerminalView (xterm.js)           │  │   │
│  │  │           ├─ TmuxGatewayView (overlay)             │  │   │
│  │  │           ├─ SftpBrowser (standalone window)       │  │   │
│  │  │           └─ StatusBar                             │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

MuxTerm has three distinct window types, all served by the same renderer entry point with URL-based routing:

| Window Type | URL Parameter | Purpose |
|-------------|--------------|---------|
| **Terminal** | (none) | Normal terminal with tabs and split panes |
| **Tmux** | `?tmux=<sessionId>` | Tmux control mode window mapped to a tmux session |
| **SFTP** | `?sftp=true` | Two-pane file browser with remote transfers |

---

## Process Model

MuxTerm follows Electron's multi-process architecture:

| Process | Runtime | Role |
|---------|---------|------|
| **Main** | Node.js | Shell management via node-pty, tmux protocol parsing, SFTP connections via ssh2-sftp-client, window lifecycle, application menu, IPC handler registration |
| **Preload** | Node.js (sandboxed bridge) | Exposes `window.terminalAPI` and `window.sftpAPI` via `contextBridge`, translating between `ipcRenderer` calls and typed TypeScript interfaces |
| **Renderer** | Chromium | React 18 UI with xterm.js terminal instances, Zustand state management, component tree rendering |

Security configuration:
- `contextIsolation: true` — renderer cannot access Node.js APIs directly
- `nodeIntegration: false` — no `require()` in renderer
- `sandbox: false` — required for node-pty's native module in the preload script

---

## Directory Structure

```
src/
├── main/                          # Electron main process
│   ├── index.ts                   # App entry: registers IPC, builds menu, creates first window
│   ├── window-manager.ts          # Creates terminal, tmux, and SFTP BrowserWindows
│   ├── pty-manager.ts             # Manages node-pty instances, DCS detection, tmux routing
│   ├── ipc-handlers.ts            # Registers all ipcMain handlers (PTY + tmux)
│   ├── menu.ts                    # Native application menu (Shell, Edit, View, Window)
│   ├── shell-resolver.ts          # Platform-aware shell detection ($SHELL, fallbacks)
│   ├── logger.ts                  # Pino logger (file + stdout)
│   ├── tmux/                      # Tmux control mode subsystem
│   │   ├── tmux-manager.ts        # Singleton registry of active TmuxSession instances
│   │   ├── tmux-session.ts        # Orchestrator for one tmux connection (init, notifications)
│   │   ├── tmux-protocol-parser.ts # Line-buffered state machine for tmux control protocol
│   │   ├── tmux-command-queue.ts  # FIFO command queue with seq-number response correlation
│   │   ├── tmux-layout-parser.ts  # Parses tmux layout strings into binary SplitNode trees
│   │   └── tmux-escape.ts         # Octal decode / hex encode for tmux data
│   └── sftp/                      # SFTP subsystem
│       ├── sftp-connection-manager.ts # ssh2-sftp-client wrapper, auth flows, file operations
│       ├── sftp-ipc-handlers.ts   # Registers all SFTP ipcMain handlers
│       ├── rsync-transfer-service.ts  # rsync-based transfers with progress, SFTP fallback
│       ├── local-file-service.ts  # Local filesystem operations (list, rename, delete, etc.)
│       └── ssh-config-parser.ts   # Parses ~/.ssh/config for host auto-discovery
├── preload/
│   ├── index.ts                   # contextBridge: exposes terminalAPI + sftpAPI
│   ├── api.ts                     # TerminalAPI type definition
│   └── sftp-api.ts                # SftpAPI type definition
├── renderer/
│   ├── main.tsx                   # React entry point (createRoot, StrictMode)
│   ├── App.tsx                    # Root component: URL routing, tab/pane orchestration, tmux wiring
│   ├── global.css                 # All styles (CSS custom properties, BEM naming)
│   ├── components/
│   │   ├── TitleBar/TitleBar.tsx  # Custom title bar (hidden native, macOS traffic lights)
│   │   ├── TabBar/
│   │   │   ├── TabBar.tsx         # Tab strip with drag-to-reorder
│   │   │   └── Tab.tsx            # Individual tab (title, close button)
│   │   ├── SplitPane/
│   │   │   ├── SplitContainer.tsx # Recursive binary tree renderer for split panes
│   │   │   └── SplitDivider.tsx   # Draggable divider between panes
│   │   ├── Terminal/
│   │   │   ├── TerminalView.tsx   # xterm.js wrapper: output routing, resize, focus
│   │   │   └── TmuxGatewayView.tsx # Overlay on trigger terminal during tmux session
│   │   ├── SftpBrowser/
│   │   │   ├── SftpBrowser.tsx    # Root SFTP component: two-pane layout, transfer logic
│   │   │   ├── FileBrowser.tsx    # Single pane: file list, selection, sorting, context menu
│   │   │   ├── AddressBar.tsx     # Path breadcrumb/input
│   │   │   ├── ConnectionBar.tsx  # Connection status + connect/disconnect button
│   │   │   ├── ConnectionDialog.tsx # SSH host picker + manual entry
│   │   │   ├── HostKeyDialog.tsx  # SSH host key verification prompt
│   │   │   ├── PasswordDialog.tsx # Password authentication prompt
│   │   │   ├── ConflictDialog.tsx # File conflict resolution (overwrite/rename/cancel)
│   │   │   └── TransferProgressBar.tsx # Active transfer progress display
│   │   └── StatusBar/StatusBar.tsx # Bottom status bar
│   ├── store/
│   │   ├── index.ts               # Zustand store: combines all slices
│   │   ├── tabs.ts                # TabsSlice: tab CRUD, reorder, active tab
│   │   ├── panes.ts               # PanesSlice: split/close/resize via SplitNode tree ops
│   │   ├── terminals.ts           # TerminalsSlice: PTY metadata registry
│   │   ├── tmux.ts                # TmuxSlice: tmux session state, window/pane mappings
│   │   └── sftp.ts                # Standalone Zustand store for SFTP browser
│   ├── hooks/
│   │   ├── useTerminal.ts         # xterm.js lifecycle: create, fit, mouse handling, dispose
│   │   ├── usePty.ts              # PTY connection hook
│   │   └── useSplitPane.ts        # Split pane drag hook
│   └── themes/
│       ├── theme.ts               # MuxTheme type definition
│       ├── dark.ts                # Dark theme (default)
│       └── light.ts               # Light theme
└── shared/                        # Types and constants shared across all processes
    ├── types.ts                   # SplitNode, Tab, TerminalMeta, PtyCreateResult
    ├── tmux-types.ts              # TmuxSessionInfo, TmuxWindowInfo, TmuxPaneInfo, etc.
    ├── sftp-types.ts              # FileEntry, ConnectionConfig, TransferRequest, etc.
    ├── ipc-channels.ts            # PTY IPC channel constants
    ├── tmux-ipc-channels.ts       # Tmux IPC channel constants
    ├── sftp-ipc-channels.ts       # SFTP IPC channel constants
    └── constants.ts               # UI constants (DEFAULT_COLS, TAB_HEIGHT, etc.)
```

---

## Build System

MuxTerm uses **electron-vite** to build all three process layers from a single config:

**`electron.vite.config.ts`:**
- **Main**: `externalizeDepsPlugin()` keeps native modules (node-pty, ssh2-sftp-client) external
- **Preload**: Same externalization for native module access
- **Renderer**: `@vitejs/plugin-react` for JSX/TSX compilation

Path alias `@shared` → `src/shared` is configured for all three targets.

**Output**: Compiled to `out/main/`, `out/preload/`, `out/renderer/`.

**Testing**: Vitest with `tests/unit/**/*.spec.ts` glob pattern. Uses `@shared` alias. Playwright available for E2E tests in `tests/e2e/`.

**Packaging**: electron-builder via `pnpm dist`.

---

## Main Process

### Entry Point

**`src/main/index.ts`**

The app entry point runs on `app.whenReady()`:

1. Registers PTY + tmux IPC handlers (`registerIpcHandlers()`)
2. Registers SFTP IPC handlers (`registerSftpIpcHandlers()`)
3. Builds the native application menu (`buildMenu()`)
4. Creates the first terminal window (`windowManager.createWindow()`)
5. Re-creates a window on `activate` (macOS dock click) if none exist
6. Quits on `window-all-closed` (except macOS)

### Window Manager

**`src/main/window-manager.ts`** — Singleton `windowManager`

Creates three window types with shared configuration:

| Method | Purpose | URL Parameter |
|--------|---------|---------------|
| `createWindow()` | Normal terminal window | (none) |
| `createTmuxWindow(sessionId)` | Tmux session window | `?tmux=<sessionId>` |
| `createSftpWindow()` | SFTP browser window | `?sftp=true` |

All windows share:
- `titleBarStyle: 'hidden'` with `trafficLightPosition: { x: 12, y: 12 }` (macOS)
- `vibrancy: 'under-window'` on macOS for translucent backgrounds
- `backgroundColor: '#0f0f1a'`
- `contextIsolation: true`, `nodeIntegration: false`
- Preload script at `../preload/index.js`
- External URL handler that opens links in the system browser

Window cleanup: on `closed`, `ptyManager.destroyAllForWindow(windowId)` kills associated PTY processes.

### PTY Manager

**`src/main/pty-manager.ts`** — Singleton `ptyManager`

Manages the lifecycle of pseudo-terminal (PTY) processes using `node-pty`.

**PTY Creation (`create`)**:
1. Resolves the user's shell (`resolveShell()`)
2. Spawns a PTY with `xterm-256color` TERM, truecolor support, user's home directory
3. Registers `onData` and `onExit` handlers
4. Returns `{ ptyId, pid, shell }` to the renderer

**DCS Detection — tmux control mode entry**:

The `onData` handler implements a state machine for detecting the tmux DCS escape sequence (`\x1bP1000p`):

```
State Machine:
  NORMAL → check for \x1b in data
    ├─ Contains full DCS → enter tmux mode immediately
    ├─ Ends with partial DCS prefix → start buffering (dcsBuffer)
    └─ No DCS → send to renderer as normal output

  BUFFERING (dcsBuffer defined) → accumulate data
    ├─ Buffer contains DCS → enter tmux mode, feed remainder to session
    ├─ Buffer ≥ 8 bytes without DCS → flush buffer to renderer, stop buffering
    └─ Otherwise → continue buffering

  TMUX MODE (tmuxMode = true) → route all data to TmuxSession.feedData()
    └─ If feedData returns non-null → %exit encountered, return to NORMAL
```

**PTY Routing (tmux mode)**:
When `tmuxMode` is true, all PTY output is fed to the `TmuxSession` parser instead of being sent to the renderer. The session's protocol parser decodes tmux notifications and routes pane output to the tmux window.

### IPC Handlers

**`src/main/ipc-handlers.ts`**

Registers all `ipcMain` handlers for PTY and tmux operations:

**PTY handlers** (request-response via `ipcMain.handle`):
- `pty:create` — Creates a new PTY, returns `PtyCreateResult`
- `pty:destroy` — Kills a PTY
- `pty:resize` — Resizes a PTY

**PTY handlers** (fire-and-forget via `ipcMain.on`):
- `pty:input` — Writes data to a PTY

**Tmux handlers** (fire-and-forget via `ipcMain.on`):
- `tmux:input` — Sends keystrokes to a tmux pane
- `tmux:resize` — Refreshes tmux client size
- `tmux:pane-resized` — Reports actual xterm.js pane dimensions
- `tmux:new-window` — Creates a new tmux window
- `tmux:split-pane` — Splits a tmux pane
- `tmux:kill-pane` — Kills a tmux pane
- `tmux:resize-pane` — Resizes a tmux pane by delta
- `tmux:detach` — Detaches from tmux session
- `tmux:force-quit` — Force-kills tmux session

**Session resolution for tmux**: The `getSessionForSender()` helper extracts the `tmux=<sessionId>` query parameter from the sender's URL to find the correct `TmuxSession` instance.

### Application Menu

**`src/main/menu.ts`**

Builds the native menu bar:

| Menu | Items |
|------|-------|
| **App** (macOS only) | About, Services, Hide, Quit |
| **Shell** | New Tab (Cmd+T), New Window (Cmd+N), SFTP Browser (Cmd+Shift+S), Split Vertical (Cmd+D), Split Horizontal (Cmd+Shift+D), Close Tab (Cmd+W), Next/Prev Tab (Ctrl+Tab) |
| **Edit** | Copy, Paste, Select All |
| **View** | Reload, Dev Tools, Zoom, Fullscreen |
| **Window** | Minimize, Zoom, Front (macOS) |

Menu actions send IPC messages to the focused window's renderer (e.g., `menu:new-tab`, `menu:split-vertical`).

### Shell Resolver

**`src/main/shell-resolver.ts`**

Platform-aware shell detection:
1. Checks `$SHELL` environment variable
2. Falls back to platform-specific candidates: `/bin/zsh` then `/bin/bash` (macOS), `/bin/bash` then `/bin/sh` (Linux)
3. Ultimate fallback: `/bin/sh`

On macOS, passes `--login` arg for proper profile loading.

### Logger

**`src/main/logger.ts`**

Uses Pino with dual transports:
- **File**: `<userData>/muxterm.log`
- **Stdout**: for development console

Log level controlled by `LOG_LEVEL` env var (default: `info`).

---

## Preload Layer

**`src/preload/index.ts`**

The preload script bridges the main and renderer processes via `contextBridge.exposeInMainWorld`. It exposes two typed API objects:

### `window.terminalAPI` (TerminalAPI)

**Request-response** (invoke/handle):
- `createPty(cols?, rows?)` → `PtyCreateResult`
- `destroyPty(ptyId)` → `void`
- `resizePty(ptyId, cols, rows)` → `void`

**Fire-and-forget** (send):
- `writePty(ptyId, data)` — Keystroke input to PTY
- `newWindow()` — Open new terminal window
- `writeTmuxPane(tmuxPaneId, data)` — Keystroke input to tmux pane
- `resizeTmux(cols, rows)` — Refresh tmux client size
- `tmuxPaneResized(tmuxPaneId, cols, rows)` — Report pane dimensions
- `tmuxNewWindow()`, `tmuxSplitPane()`, `tmuxKillPane()`, `tmuxResizePane()`
- `tmuxDetach(ptyId)`, `tmuxForceQuit(ptyId)`

**Event listeners** (returns unsubscribe function):
- `onPtyOutput`, `onPtyExit`, `onPtyTitle`
- `onMenuNewTab`, `onMenuCloseTab`, `onMenuSplitVertical`, `onMenuSplitHorizontal`, `onMenuNextTab`, `onMenuPrevTab`
- `onTmuxDetected`, `onTmuxSessionReady`, `onTmuxOutput`, `onTmuxScrollback`
- `onTmuxTabAdd`, `onTmuxTabClose`, `onTmuxTabRenamed`, `onTmuxLayoutChange`, `onTmuxExit`

### `window.sftpAPI` (SftpAPI)

**Request-response**:
- `parseSshConfig()` → `SshHostConfig[]`
- `connect(config)` → connection ID
- `disconnect()`
- `remoteList/remoteRename/remoteDelete/remoteMkdir/remoteExists/remoteHome`
- `localList/localRename/localCopy/localDelete/localMkdir/localExists/localHome/localOpenFile`
- `transferStart(request)`

**Fire-and-forget**:
- `transferCancel(transferId)`
- `respondHostKey(accepted)` — Host key verification response
- `respondPassword(password)` — Password authentication response
- `newSftpWindow()`

**Event listeners**:
- `onTransferProgress`, `onTransferComplete`, `onTransferError`
- `onHostKeyVerify`, `onPasswordPrompt`

---

## Renderer Process

### App Component and Routing

**`src/renderer/App.tsx`**

The root `App` component uses URL query parameters for window-type routing:

```
URL                          → Component
?sftp=true                   → <SftpBrowser />  (early return)
?tmux=<sessionId>            → Terminal UI in tmux mode
(no params)                  → Terminal UI in normal mode
```

**Normal mode lifecycle**:
1. On mount, creates an initial tab with a new PTY
2. Listens for PTY exit events to auto-close panes/tabs
3. When the last tab closes, the window closes
4. Menu events (new tab, close, split) handled via `onMenu*` listeners

**Tmux mode lifecycle**:
1. On mount, detects `?tmux=<sessionId>` — does NOT create an initial tab
2. Waits for `onTmuxSessionReady` event from main process
3. Builds tabs from tmux windows, split panes from layout trees
4. Maps tmux window IDs → tab IDs, stores in Zustand
5. Listens for `onTmuxTabAdd/Close/Renamed/LayoutChange/Exit`
6. Layout changes are merged with existing tree to preserve `paneId` mappings (prevents xterm.js remounting)

**Gateway overlay**: In normal mode, when `onTmuxDetected` fires (user ran `tmux -CC`), a `TmuxGatewayView` overlay appears on the trigger terminal showing the session name with Esc (detach) and X (force-quit) controls.

### State Management (Zustand)

**`src/renderer/store/index.ts`**

The main app store combines four slices using Zustand's `create` with spread composition:

```typescript
type AppStore = TabsSlice & PanesSlice & TerminalsSlice & TmuxSlice
```

#### TabsSlice (`store/tabs.ts`)

```
State:
  tabs: Tab[]             — ordered list of open tabs
  activeTabId: string     — currently focused tab

Actions:
  addTab(tab)             — append tab, set as active
  removeTab(tabId)        — remove tab, auto-select adjacent
  setActiveTab(tabId)     — switch active tab
  updateTabTitle(tabId, title)
  updateTabRoot(tabId, rootNode) — replace split tree (used by tmux layout changes)
  updateTabActivePane(tabId, paneId)
  reorderTabs(from, to)   — drag-to-reorder support
```

#### PanesSlice (`store/panes.ts`)

Operates on the `SplitNode` binary tree within each tab:

```
Actions:
  splitPane(tabId, paneId, direction, newPaneId, newPtyId)
    — Finds the leaf node with `paneId` and wraps it in a split node
  closePane(tabId, paneId)
    — Removes the leaf node, collapses parent split
  resizePane(tabId, paneId, ratio)
    — Updates the split ratio of the parent split node
```

The tree operations are pure functions:
- `splitNode()` — wraps a leaf in a new split
- `removeNode()` — removes a leaf, returns sibling as replacement
- `updateRatio()` — finds parent split of a pane and sets ratio

Utility exports:
- `collectPtyIds(node)` — collects all PTY IDs in a tree (for cleanup)
- `findPtyForPane(node, paneId)` — finds the PTY ID for a given pane

#### TerminalsSlice (`store/terminals.ts`)

```
State:
  terminals: Record<ptyId, TerminalMeta>  — PTY metadata (pid, shell, cols, rows)

Actions:
  setTerminal(ptyId, meta)
  removeTerminal(ptyId)
  updateTerminalSize(ptyId, cols, rows)
```

#### TmuxSlice (`store/tmux.ts`)

```
State:
  isTmuxWindow: boolean
  tmuxSessionId: string | null
  tmuxSessionName: string | null
  tmuxTriggerPtyId: string | null     — PTY that triggered tmux (for gateway overlay)
  tmuxActiveWindowId: string | null
  tmuxWindowToTab: Record<tmuxWindowId, tabId>
  tmuxPaneToLocal: Record<tmuxPaneId, localPaneId>
  tmuxScrollback: Record<tmuxPaneId, scrollbackData>

Actions:
  setTmuxMode(sessionId, sessionName, triggerPtyId)
  setTmuxTrigger(ptyId, sessionName) / clearTmuxTrigger()
  addTmuxWindowMapping / removeTmuxWindowMapping
  addTmuxPaneMapping / removeTmuxPaneMapping
  setTmuxScrollback(scrollback)
  consumeTmuxScrollback(tmuxPaneId) — returns and removes scrollback for one-time consumption
  clearTmuxMode() — resets all tmux state
```

#### SFTP Store (`store/sftp.ts`)

Separate standalone Zustand store (not composed with the main store):

```
State:
  connected, connecting, connectionError, connectionConfig
  localPath, localFiles, localLoading, localSelection
  remotePath, remoteFiles, remoteLoading, remoteSelection
  clipboard: { files, operation: 'copy'|'cut', source: 'local'|'remote' } | null
  transfers: Map<transferId, TransferProgress>
  showConnectionDialog, hostKeyInfo, showPasswordDialog, conflictInfo

Actions:
  Setters for each state field
  updateTransfer / removeTransfer
  reset() — returns to initial state
```

### Terminal Rendering

#### useTerminal Hook (`hooks/useTerminal.ts`)

Manages the xterm.js `Terminal` lifecycle:

**Addons loaded**:
- `FitAddon` — auto-fits terminal to container dimensions
- `WebLinksAddon` — clickable URLs
- `Unicode11Addon` — proper Unicode character width handling

**Note**: WebGL addon is intentionally disabled due to `renderService.dimensions` errors that corrupt the renderer state. Canvas/DOM rendering is used instead.

**Key handler**: `Ctrl+Tab` is intercepted and not consumed by xterm.js so it can bubble up to Electron's menu accelerator for tab switching.

**Mouse Mode Tracker** (`MouseModeTracker` class):

A critical piece of the terminal — tracks mouse mode state by scanning escape sequences in output data:

| Mode | Escape Code | Behavior |
|------|-------------|----------|
| X10 (`?9h`) | Press only |
| VT200 (`?1000h`) | Press + release |
| Button-event (`?1002h`) | Press + release + drag |
| Any-event (`?1003h`) | All mouse motion |
| SGR (`?1006h`) | Extended coordinate encoding |

**Why manual mouse handling?** xterm.js's internal `MouseService.getCoords()` fails when `renderService.dimensions` is undefined — a known issue with terminal initialization timing. MuxTerm handles mouse events manually:

1. `getCellCoords(e)` — Calculates cell position from pixel coordinates using `.xterm-screen` element bounds
2. `encodeMouseEvent()` — Generates the correct escape sequence (legacy X10/VT200 or SGR format)
3. Mouse listeners on `mousedown`, `mouseup`, `mousemove`, `wheel`, `contextmenu` are registered with `capture: true` and cleaned up via `AbortController`

This enables mouse-aware applications (vim, htop, ncurses) to work correctly.

**ResizeObserver**: Watches the container element and calls `fitAddon.fit()` on size changes (debounced via `requestAnimationFrame`).

#### TerminalView Component (`components/Terminal/TerminalView.tsx`)

Wraps `useTerminal` and connects it to the IPC layer:

**Normal mode**:
- `onData` → `writePty(ptyId, data)` — keystrokes to PTY
- `onResize` → `resizePty(ptyId, cols, rows)` — resize PTY
- `onPtyOutput` listener → `terminal.write(data)` — output to screen

**Tmux mode** (when `tmuxPaneId` is set):
- `onData` → `writeTmuxPane(tmuxPaneId, data)` — keystrokes to tmux pane
- `onResize` → `tmuxPaneResized(tmuxPaneId, cols, rows)` — report dimensions
- `onTmuxOutput` listener → `terminal.write(data)` — pane output to screen
- `onTmuxScrollback` listener → `terminal.write(data)` — scrollback for new panes

On mount in tmux mode, scrollback data is written from `tmuxScrollback` store (read non-destructively to handle React StrictMode double-mounts).

### Split Pane System

**`SplitContainer` (`components/SplitPane/SplitContainer.tsx`)**

Recursive component that renders a `SplitNode` binary tree:

```
SplitNode (leaf)  → TerminalView
SplitNode (split) → flex container with:
                     ├── first child  (percentage width/height)
                     ├── SplitDivider (draggable)
                     └── second child (flex: 1)
```

- `direction: 'vertical'` → `flexDirection: 'row'` (side-by-side)
- `direction: 'horizontal'` → `flexDirection: 'column'` (stacked)

**Tmux resize**: In tmux mode, divider drag triggers `tmuxResizePane(tmuxPaneId, direction, delta)` which sends a `resize-pane` command to tmux. The resulting `%layout-change` notification updates the tree.

**`SplitDivider` (`components/SplitPane/SplitDivider.tsx`)**

A draggable 1px divider (4px hover zone). In normal mode, drag directly updates the split ratio. In tmux mode, drag calculates a column/row delta and sends it as a tmux resize command, with a shadow preview indicator.

### Tab Bar

**`TabBar` (`components/TabBar/TabBar.tsx`)** — Horizontal tab strip with:
- Tab labels and close buttons
- "+" button for new tabs
- Drag-to-reorder support
- Active tab highlighting

**`Tab` (`components/TabBar/Tab.tsx`)** — Individual tab component.

### Theming

**`themes/theme.ts`** — Defines the `MuxTheme` interface:
```typescript
interface MuxTheme {
  font: { family, size, lineHeight }
  terminal: { background, foreground, cursor, ..., all 16 ANSI colors }
  ui: { titleBar, tabBar, statusBar, ... }
}
```

**`themes/dark.ts`** — Default dark theme with purple-tinted dark backgrounds.
**`themes/light.ts`** — Light theme variant.

---

## Tmux Control Mode

### Tmux Overview

MuxTerm implements tmux control mode (`tmux -CC`) integration, which allows tmux sessions to be displayed with native UI elements instead of the tmux terminal multiplexer interface. This is a complex subsystem involving:

1. **Detection**: Recognizing the DCS escape sequence that signals tmux control mode
2. **Protocol parsing**: Line-by-line state machine for the tmux control protocol
3. **Command queue**: Serialized command/response correlation
4. **Session orchestration**: Initialization sequence, notification routing, lifecycle management
5. **Layout parsing**: Converting tmux's layout string format to binary split trees
6. **Renderer integration**: Mapping tmux windows → tabs, tmux panes → terminal views

### DCS Detection and Session Lifecycle

```
User types: tmux -CC new -s mysession
                    │
                    ▼
          ┌─────────────────┐
          │   Shell PTY     │
          │  (node-pty)     │
          └────────┬────────┘
                   │ onData
                   ▼
          ┌─────────────────┐
          │   PtyManager    │
          │  DCS detection  │──── Detects \x1bP1000p
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐     ┌──────────────────┐
          │  TmuxManager    │────▶│ WindowManager     │
          │  startSession() │     │ createTmuxWindow()│
          └────────┬────────┘     └──────────────────┘
                   │                        │
                   ▼                        ▼
          ┌─────────────────┐     ┌──────────────────┐
          │  TmuxSession    │     │ New BrowserWindow │
          │  (orchestrator) │     │ ?tmux=sessionId   │
          └─────────────────┘     └──────────────────┘
```

**The DCS sequence `\x1bP1000p`** is the tmux control mode entry marker. When detected:
1. Any data before the DCS is sent to the renderer as normal output
2. `PtyManager` sets `tmuxMode = true` on the PTY instance
3. `TmuxManager.startSession()` creates a new `TmuxSession`
4. A new `BrowserWindow` with `?tmux=<sessionId>` is created
5. All subsequent PTY data is routed to `TmuxSession.feedData()`

### Protocol Parser

**`src/main/tmux/tmux-protocol-parser.ts`**

A line-buffered state machine that parses the tmux control mode protocol. The protocol is newline-delimited with these message types:

**Command responses** (wrapped in %begin/%end):
```
%begin SEQ FLAGS CMD_NUMBER
...response lines...
%end SEQ FLAGS CMD_NUMBER
```
or `%error` instead of `%end` for failures.

**Notifications** (standalone lines):
```
%output %PANE DATA          — Pane output (octal-escaped newlines)
%window-add @ID             — New window created
%window-close @ID           — Window closed
%window-renamed @ID NAME    — Window renamed
%layout-change @ID LAYOUT   — Pane layout changed
%exit [REASON]              — Session ended
```

The parser emits two event types:
- `'response'` — `CommandResponse { seqNumber, success, lines[] }` for command results
- `'notification'` — `TmuxNotification { type, paneId?, windowId?, data?, ... }` for async events

**Key design detail**: Newlines in `%output` data are encoded as `\012` (octal). The `decodeOctalEscapes()` function in `tmux-escape.ts` handles this, so `\n` in the raw stream always means "end of protocol line."

After `%exit`, the parser sets `exited = true` and returns all remaining buffered data as raw shell output (the user's shell is now active again).

### Command Queue

**`src/main/tmux/tmux-command-queue.ts`**

A FIFO queue that sends tmux commands one at a time and waits for responses:

```
send("list-windows -F ...") → Promise<string[]>
         │
         ▼
    Write "list-windows -F ...\n" to PTY
         │
    Wait for parser 'response' event with matching seq
         │
         ▼
    Resolve promise with response lines
```

Commands are serialized — only one command is in-flight at a time. This prevents response interleaving. The queue has error handling:
- Failed commands (responses via `%error`) reject the promise
- `dispose()` rejects all pending/queued commands

### Session Orchestrator

**`src/main/tmux/tmux-session.ts`**

The `TmuxSession` class orchestrates a complete tmux control mode connection:

**Initialization sequence** (runs after tmux window's `did-finish-load`):

1. `display-message -p "#{session_name}"` → get session name
2. Send `tmux:detected` to trigger window (shows gateway overlay)
3. `list-windows -F "#{window_id} #{window_name} #{window_layout} #{window_active}"` → enumerate windows
4. For each window: `list-panes -t @ID -F "#{pane_id} #{pane_width} #{pane_height} #{pane_active}"` → enumerate panes
5. Parse each window's layout string into a `SplitNode` tree
6. `refresh-client -C 200x50` → set initial client size
7. For each pane: `capture-pane -t %ID -p -e -S -` → capture scrollback history
8. Send `tmux:session-ready` with full `TmuxSessionInfo` (windows, panes, scrollback)
9. Set `ready = true`, flush buffered output

**Notification handling**:
- `%output` → Buffer if not ready, otherwise forward to tmux window via `tmux:output` IPC
- `%window-add` → Query window details, parse layout, forward via `tmux:tab-add`
- `%window-close` → Remove from internal list, forward via `tmux:tab-close`
- `%window-renamed` → Update name, forward via `tmux:tab-renamed`
- `%layout-change` → Parse new layout, forward via `tmux:layout-change`, capture scrollback for new panes
- `%exit` → Notify both windows, trigger cleanup

**Commands sent to tmux**:
- `send-keys -t %ID -H <hex>` — Send keystrokes (hex-encoded via `encodeToHex`)
- `refresh-client -C COLSxROWS` — Update client dimensions
- `new-window`, `split-window -h/-v -t %ID`, `kill-pane -t %ID`
- `resize-pane -t %ID -R/-L/-U/-D N` — Resize pane by delta
- `detach-client` — Graceful detach

### Layout Parser

**`src/main/tmux/tmux-layout-parser.ts`**

Converts tmux layout strings into binary `SplitNode` trees.

**Tmux layout format**: `CHECKSUM,WxH,X,Y{children}` or `[children]`
- `{...}` = horizontal arrangement (left-right) → MuxTerm `direction: 'vertical'`
- `[...]` = vertical arrangement (top-bottom) → MuxTerm `direction: 'horizontal'`
- Leaf: `WxH,X,Y,PANE_ID`

**N-ary to binary conversion**: Tmux supports N-way splits. The parser converts them to binary trees using right-nesting: `split(c1, split(c2, split(c3, c4)))`. Ratios are computed from child dimensions including 1px dividers.

Example:
```
Input:  "34a4,202x51,0,0{101x51,0,0,0,100x51,102,0,1}"
Output: { type: 'split', direction: 'vertical', ratio: 0.497,
          first:  { type: 'leaf', paneId: 'tmux-pane-0', tmuxPaneId: '%0' },
          second: { type: 'leaf', paneId: 'tmux-pane-1', tmuxPaneId: '%1' } }
```

### Escape Encoding

**`src/main/tmux/tmux-escape.ts`**

Two utility functions:

- `decodeOctalEscapes(input)` — Converts tmux octal escapes (`\012` → `\n`, `\134` → `\`) in `%output` data
- `encodeToHex(data)` — Converts UTF-8 string to hex bytes for `send-keys -H` (e.g., `'A'` → `'41'`)

### Tmux Renderer Integration

In the renderer, tmux integration works through these mechanisms:

1. **App.tsx** detects `?tmux=` in URL → waits for `onTmuxSessionReady`
2. On session ready: builds tabs from `TmuxSessionInfo.windows[]`, stores scrollback
3. `mergeLayoutTree()` preserves existing `paneId` values when layout changes occur (keyed by `tmuxPaneId`), preventing React from remounting `TerminalView` components and losing xterm.js state
4. Each `TerminalView` with a `tmuxPaneId` routes input via `writeTmuxPane` instead of `writePty`, and listens on `onTmuxOutput` instead of `onPtyOutput`

### Resize System

The resize system is **pane-driven** — individual xterm.js instances report their actual dimensions after `FitAddon.fit()`:

```
ResizeObserver triggers
        │
        ▼
  FitAddon.fit() → terminal.onResize(cols, rows)
        │
        ▼
  tmuxPaneResized(tmuxPaneId, cols, rows)  [IPC to main]
        │
        ▼
  TmuxSession.paneResized()
    ├─ Store pane size
    ├─ Debounce 100ms (multiple panes resize in same frame)
    └─ computeAndSendClientSize()
          ├─ Find window containing resized pane
          ├─ Walk layout tree, sum child sizes + dividers
          └─ refresh-client -C COLSxROWS (if changed)
```

**Feedback loop prevention**: After a `%layout-change`, pane resize reports are suppressed for 300ms to prevent tmux → layout change → resize → refresh-client → layout change loops. New panes always force a resize.

---

## SFTP Browser

### SFTP Overview

The SFTP browser is an independent module with its own window type, store, and IPC layer. It provides a two-pane file manager (local left, remote right) with SSH-based file transfer capabilities.

```
┌──────────────────────────────────────────────────┐
│  SFTP Browser Window (?sftp=true)                │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │         ConnectionBar (status + connect)      │ │
│  ├─────────────────────┬───────────────────────┤ │
│  │    Local Pane       │    Remote Pane         │ │
│  │  ┌───────────────┐  │  ┌───────────────────┐│ │
│  │  │ AddressBar    │  │  │ AddressBar        ││ │
│  │  ├───────────────┤  │  ├───────────────────┤│ │
│  │  │ FileBrowser   │  │  │ FileBrowser       ││ │
│  │  │ (sortable     │  │  │ (sortable         ││ │
│  │  │  columns,     │  │  │  columns,         ││ │
│  │  │  context menu,│  │  │  context menu,    ││ │
│  │  │  selection,   │  │  │  selection,       ││ │
│  │  │  drag-drop)   │  │  │  drag-drop)       ││ │
│  │  └───────────────┘  │  └───────────────────┘│ │
│  ├─────────────────────┴───────────────────────┤ │
│  │         TransferProgressBar                   │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Dialogs: ConnectionDialog, HostKeyDialog,       │
│           PasswordDialog, ConflictDialog          │
└──────────────────────────────────────────────────┘
```

### Connection Manager

**`src/main/sftp/sftp-connection-manager.ts`** — Singleton `sftpConnectionManager`

Manages SSH/SFTP connections per window using `ssh2-sftp-client`:

**Authentication flow**:
1. Read SSH private key from `identityFile` (if configured)
2. If no key available, prompt for password via IPC round-trip
3. Attempt connection with key
4. If key auth fails, fall back to password prompt
5. Host key verification via IPC round-trip (sends fingerprint to renderer, waits for accept/reject)

**IPC round-trip pattern** (used for host key and password prompts):
```
Main: win.webContents.send('sftp:host-key-verify', info)
Main: ipcMain.once('sftp:host-key-response', handler)
        ↕ (user sees dialog, clicks accept/reject)
Renderer: sftpAPI.respondHostKey(accepted)
Main: handler resolves promise with accepted
```

**File operations**: `list()`, `remoteRename()`, `remoteDelete()`, `remoteMkdir()`, `remoteExists()`, `remoteHome()`

**Symlink resolution**: The `list()` method resolves symlinks — when `item.type === 'l'`, it calls `client.stat(fullPath)` which follows the symlink. If stat fails (broken symlink), the entry is treated as a file.

### Transfer Service

**`src/main/sftp/rsync-transfer-service.ts`**

File transfers use rsync when available, with ssh2-sftp-client as fallback:

**rsync mode**:
1. Checks `rsync --version` availability (cached)
2. Constructs rsync command with `-avz --progress -e "ssh -p PORT -i KEY"`
3. Parses stdout for progress: `"  1,234,567  45%   1.23MB/s    0:01:23"`
4. Sends `TransferProgress` updates to renderer
5. On close: sends `transfer-complete` or `transfer-error`

**SFTP fallback**: Uses `client.fastPut()`/`client.fastGet()` with step callback for progress.

**Cancellation**: `cancelTransfer(id)` sends SIGTERM to the rsync child process.

### Local File Service

**`src/main/sftp/local-file-service.ts`**

Local filesystem operations using Node.js `fs` module: list directory, rename, copy, delete (files and directories), mkdir, exists check, open file with system default app (`shell.openItem`).

### SSH Config Parser

**`src/main/sftp/ssh-config-parser.ts`**

Parses `~/.ssh/config` to extract host configurations for the connection dialog's host picker. Returns `SshHostConfig[]` with host, hostname, port, user, and identity file.

### SFTP IPC Handlers

**`src/main/sftp/sftp-ipc-handlers.ts`**

Registers all SFTP-related `ipcMain.handle` and `ipcMain.on` handlers, delegating to `sftpConnectionManager`, `localFileService`, and `rsyncTransferService`.

### SFTP Renderer Components

| Component | Purpose |
|-----------|---------|
| `SftpBrowser` | Root: two-pane layout, clipboard operations (cut/copy/paste), transfer initiation, keyboard shortcuts, context menu callbacks |
| `FileBrowser` | Single pane: file list rendering, column sorting (name/size/date/perms with dirs-first), multi-selection (Cmd+Click, Shift+Click), right-click context menu, drag-and-drop |
| `AddressBar` | Current path display, manual path entry |
| `ConnectionBar` | Connection status indicator, connect/disconnect button |
| `ConnectionDialog` | SSH host picker (from `~/.ssh/config`) or manual entry fields |
| `HostKeyDialog` | Displays SSH host key fingerprint for user verification |
| `PasswordDialog` | Password input for SSH authentication |
| `ConflictDialog` | File conflict resolution: Cancel, Overwrite, or Rename |
| `TransferProgressBar` | Shows active transfers with progress bar, speed, cancel button |

### SFTP Store

**`store/sftp.ts`** — Standalone Zustand store (separate from the main terminal store).

Tracks: connection state, local/remote file listings, selection state, clipboard, active transfers, and dialog visibility. The store is scoped to a single SFTP window.

---

## IPC Channel Reference

### PTY Channels (`src/shared/ipc-channels.ts`)

| Channel | Direction | Transport | Purpose |
|---------|-----------|-----------|---------|
| `pty:create` | R→M | handle/invoke | Create new PTY |
| `pty:destroy` | R→M | handle/invoke | Kill PTY |
| `pty:resize` | R→M | handle/invoke | Resize PTY |
| `pty:input` | R→M | send/on | Write data to PTY |
| `pty:output` | M→R | send/on | PTY output data |
| `pty:exit` | M→R | send/on | PTY process exited |
| `pty:title` | M→R | send/on | Terminal title changed |
| `window:new` | R→M | send/on | Create new window |

### Tmux Channels (`src/shared/tmux-ipc-channels.ts`)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `tmux:detected` | M→R (trigger) | DCS detected, show gateway overlay |
| `tmux:session-ready` | M→R (tmux) | Session initialized with windows/panes/scrollback |
| `tmux:output` | M→R (tmux) | Pane output data |
| `tmux:scrollback` | M→R (tmux) | Scrollback for newly created panes |
| `tmux:tab-add` | M→R (tmux) | New tmux window created |
| `tmux:tab-close` | M→R (tmux) | Tmux window closed |
| `tmux:tab-renamed` | M→R (tmux) | Tmux window renamed |
| `tmux:layout-change` | M→R (tmux) | Pane layout changed (split/resize) |
| `tmux:exit` | M→R (both) | Session ended |
| `tmux:input` | R→M | Keystrokes to tmux pane |
| `tmux:resize` | R→M | Refresh client size |
| `tmux:pane-resized` | R→M | Report actual pane dimensions |
| `tmux:new-window` | R→M | Create tmux window |
| `tmux:split-pane` | R→M | Split tmux pane |
| `tmux:kill-pane` | R→M | Kill tmux pane |
| `tmux:resize-pane` | R→M | Resize tmux pane by delta |
| `tmux:detach` | R→M | Detach from session |
| `tmux:force-quit` | R→M | Force-kill session |

### SFTP Channels (`src/shared/sftp-ipc-channels.ts`)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `sftp:parse-ssh-config` | R→M | Parse ~/.ssh/config |
| `sftp:connect` | R→M | Connect to remote host |
| `sftp:disconnect` | R→M | Disconnect |
| `sftp:remote-list/rename/delete/mkdir/exists/home` | R→M | Remote file operations |
| `sftp:local-list/rename/copy/delete/mkdir/exists/home/open-file` | R→M | Local file operations |
| `sftp:transfer-start` | R→M | Start file transfer |
| `sftp:transfer-cancel` | R→M | Cancel transfer |
| `sftp:transfer-progress` | M→R | Transfer progress update |
| `sftp:transfer-complete` | M→R | Transfer completed |
| `sftp:transfer-error` | M→R | Transfer failed |
| `sftp:host-key-verify` | M→R | Host key verification prompt |
| `sftp:host-key-response` | R→M | Host key accept/reject |
| `sftp:password-prompt` | M→R | Password authentication prompt |
| `sftp:password-response` | R→M | Password response |
| `sftp:window-new` | R→M | Open new SFTP window |

### Menu Channels (inline strings)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `menu:new-tab` | M→R | Cmd+T |
| `menu:close-tab` | M→R | Cmd+W |
| `menu:split-vertical` | M→R | Cmd+D |
| `menu:split-horizontal` | M→R | Cmd+Shift+D |
| `menu:next-tab` | M→R | Ctrl+Tab |
| `menu:prev-tab` | M→R | Ctrl+Shift+Tab |

---

## Data Flow Diagrams

### Normal Terminal Keystroke Flow

```
User presses key
      │
      ▼
  xterm.js terminal.onData(data)
      │
      ▼
  TerminalView.handleData(data)
      │
      ▼
  window.terminalAPI.writePty(ptyId, data)
      │
      ▼ (ipcRenderer.send → ipcMain.on)
  ipc-handlers.ts: ptyManager.write(ptyId, data)
      │
      ▼
  node-pty: proc.write(data)
      │
      ▼ (shell processes, produces output)
  node-pty: proc.onData(output)
      │
      ▼
  PtyManager: window.webContents.send('pty:output', ptyId, output)
      │
      ▼ (ipcMain → ipcRenderer)
  preload: onPtyOutput callback fires
      │
      ▼
  TerminalView useEffect: terminal.write(data)
      │
      ▼
  xterm.js renders output to screen
```

### Tmux Control Mode Attach Flow

```
User types: tmux -CC attach -t mysession
      │
      ▼
  Shell PTY produces DCS: \x1bP1000p
      │
      ▼
  PtyManager.onData detects DCS sequence
      │
      ├──▶ Sets instance.tmuxMode = true
      │
      ▼
  tmuxManager.startSession(ptyId, window)
      │
      ├──▶ Creates TmuxSession(ptyId, triggerWindow, writeFn, createTmuxWindow)
      │     │
      │     ├──▶ windowManager.createTmuxWindow(sessionId)
      │     │         │
      │     │         └──▶ New BrowserWindow with ?tmux=sessionId
      │     │
      │     └──▶ tmuxWindow.webContents.on('did-finish-load', () => initialize())
      │
      ▼
  TmuxSession.initialize()
      │
      ├─ 1. display-message → get session name
      ├─ 2. Send tmux:detected to trigger window (shows gateway)
      ├─ 3. list-windows → enumerate windows
      ├─ 4. For each: list-panes + parseTmuxLayout
      ├─ 5. refresh-client -C 200x50
      ├─ 6. For each pane: capture-pane → scrollback
      ├─ 7. Send tmux:session-ready to tmux window
      │         │
      │         ▼ (Renderer receives)
      │     App.tsx: onTmuxSessionReady
      │       ├─ setTmuxMode()
      │       ├─ setTmuxScrollback()
      │       └─ For each window:
      │           ├─ addTmuxWindowMapping(windowId, tabId)
      │           ├─ addTab({ rootNode from layout })
      │           └─ setActiveTab (if active)
      │
      └─ 8. Flush buffered output
```

### SFTP Connect and Browse Flow

```
User opens SFTP Browser (Cmd+Shift+S)
      │
      ▼
  menu.ts: windowManager.createSftpWindow()
      │
      ▼
  New BrowserWindow with ?sftp=true
      │
      ▼
  App.tsx: isSftpWindow() → return <SftpBrowser />
      │
      ├── Loads local home directory (localList)
      │
      ▼ (User clicks Connect)
  ConnectionDialog: selects host from ~/.ssh/config
      │
      ▼
  sftpAPI.connect(config)
      │
      ▼ (ipcMain.handle)
  SftpConnectionManager.connect()
      │
      ├── Read identity file (if configured)
      │
      ├── Host key verification (IPC round-trip):
      │   Main → send HOST_KEY_VERIFY → Renderer shows HostKeyDialog
      │   User clicks Accept → Renderer sends HOST_KEY_RESPONSE → Main resolves
      │
      ├── Password prompt (IPC round-trip, if needed):
      │   Main → send PASSWORD_PROMPT → Renderer shows PasswordDialog
      │   User enters password → Renderer sends PASSWORD_RESPONSE → Main resolves
      │
      ├── client.connect(connectConfig)
      │
      └── Return connection ID
      │
      ▼
  SftpBrowser: setConnected(true), load remote home (remoteList)
      │
      ▼ (User navigates, transfers files)
  Double-click dir → remoteList(path)
  Drag file across panes → transferStart(request)
      │
      ▼
  rsync-transfer-service: spawn rsync process
      │ (stdout progress updates → TRANSFER_PROGRESS IPC)
      ▼
  TransferProgressBar renders progress
```

---

## Shared Types

### `src/shared/types.ts`

```typescript
type SplitDirection = 'horizontal' | 'vertical'

type SplitNode =
  | { type: 'leaf'; paneId: string; ptyId: string; tmuxPaneId?: string }
  | { type: 'split'; direction: SplitDirection; ratio: number;
      first: SplitNode; second: SplitNode }

interface Tab {
  id: string; title: string; rootNode: SplitNode; activePaneId: string
}

interface TerminalMeta {
  ptyId: string; pid: number; shell: string; cols: number; rows: number
}

interface PtyCreateResult {
  ptyId: string; pid: number; shell: string
}
```

The `SplitNode` type is the core data structure for pane layout. It forms a binary tree where:
- **Leaf nodes** represent terminal panes (with optional `tmuxPaneId` for tmux mode)
- **Split nodes** contain a direction, ratio (0-1), and two children

### `src/shared/tmux-types.ts`

- `TmuxPaneInfo` — pane dimensions and active state
- `TmuxWindowInfo` — window with panes list and parsed `rootNode`
- `TmuxSessionInfo` — complete session state sent on init (windows, scrollback)
- `TmuxCommandResponse` — parsed response from command queue
- Various notification types for protocol events

### `src/shared/sftp-types.ts`

- `FileEntry` — file/directory metadata (name, path, isDirectory, size, modifiedAt, permissions)
- `SshHostConfig` — parsed SSH config entry
- `ConnectionConfig` — connection parameters
- `TransferRequest` — transfer specification (source, dest, direction, isDirectory)
- `TransferProgress` — live transfer status (bytes, percentage, speed)
- `HostKeyInfo` — SSH host key for verification dialog

### `src/shared/constants.ts`

```typescript
DEFAULT_COLS = 80
DEFAULT_ROWS = 24
MIN_SPLIT_RATIO = 0.1
MAX_SPLIT_RATIO = 0.9
SPLIT_DIVIDER_SIZE = 1
SPLIT_DIVIDER_HOVER_SIZE = 4
TAB_HEIGHT = 32
TITLEBAR_HEIGHT = 40
STATUSBAR_HEIGHT = 24
```

---

## Testing

**Framework**: Vitest

**Configuration** (`vitest.config.ts`):
- Test files: `tests/unit/**/*.spec.ts`
- Globals enabled (no explicit imports for `describe`, `it`, `expect`)
- `@shared` path alias for imports

**Test structure**:
```
tests/
├── unit/                    # Unit tests
│   ├── pty-manager.spec.ts
│   ├── tmux-protocol-parser.spec.ts
│   ├── tmux-command-queue.spec.ts
│   ├── tmux-layout-parser.spec.ts
│   ├── tmux-escape.spec.ts
│   ├── tmux-session.spec.ts
│   ├── shell-resolver.spec.ts
│   ├── sftp-connection-manager.spec.ts
│   ├── local-file-service.spec.ts
│   ├── ssh-config-parser.spec.ts
│   ├── rsync-transfer-service.spec.ts
│   ├── store-panes.spec.ts
│   └── store-tabs.spec.ts
└── e2e/                     # Playwright E2E tests
```

**Mocking pattern**: Tests use `vi.hoisted()` for module mocks (node-pty, electron, ssh2-sftp-client) and `vi.mock()` to replace implementations.

**E2E**: Playwright is configured but tests are minimal — the primary testing approach is unit tests with mocked Electron/Node.js APIs.

---

## CSS and Styling

**`src/renderer/global.css`** — Single CSS file for all styles.

**Design system**:
- CSS custom properties (variables) for theming:
  ```css
  --bg: #0f0f1a;
  --bg-secondary: #1a1a2e;
  --text: #e0e0e8;
  --text-muted: #6b6b80;
  --accent: #7c3aed;
  --border: #2a2a3e;
  ```
- BEM-like naming: `.split-container`, `.tab-bar__tab`, `.sftp-context-menu__item--danger`
- No CSS modules or CSS-in-JS — plain class names

**Key style sections**:
- App layout (`.app`, `.app__content`, `.app__tab-content`)
- Title bar (`.titlebar`) with macOS traffic light padding
- Tab bar (`.tab-bar`, `.tab-bar__tab`, `.tab-bar__add`)
- Split pane (`.split-divider`, `.split-divider--hover`)
- Terminal view (`.terminal-view`, `.terminal-view--active`)
- Tmux gateway overlay (`.tmux-gateway`)
- SFTP browser (`.sftp-browser`, `.sftp-file-browser`, `.sftp-pane`)
- SFTP dialogs (`.sftp-dialog`, `.sftp-dialog-overlay`)
- SFTP context menu (`.sftp-context-menu`)
- Transfer progress (`.sftp-transfer`)
- Buttons (`.sftp-btn`, `.sftp-btn--primary`, `.sftp-btn--secondary`)
- Status bar (`.statusbar`)

**Z-index layering**:
| Z-index | Element |
|---------|---------|
| 300 | Context menu |
| 200 | Dialog overlay |
| 100 | Title bar |
| 10 | Tab bar |
| 5 | Split divider (during drag) |
