Implement the following plan:

# Tmux Control Mode Integration Plan

## Context

Add iTerm2-style tmux control mode (`tmux -CC`) integration to MuxTerm. When a user runs `tmux -CC` in any terminal pane (local or over SSH), the app detects the DCS sequence `\033P1000p`, opens a new native window mapped to the tmux session, and renders tmux windows as tabs and tmux panes as split panes — with full scrollback history, colors, and xterm features. The triggering terminal shows a gateway overlay with Esc to detach / X to force-quit.

## Architecture Overview

**Detection**: `pty-manager.ts` intercepts `\033P1000p` in PTY output → creates `TmuxSession` which owns a protocol parser, command queue, and manages the tmux BrowserWindow.

**Data flow**: All tmux protocol traffic flows through the single control-mode PTY in the main process. `TmuxSession` parses it and routes decoded `%output` data to the correct pane in the tmux BrowserWindow via IPC. User keystrokes go back as `send-keys -H` commands through the same PTY.

**Mapping**: tmux session → BrowserWindow, tmux window → tab, tmux pane → SplitNode leaf.

---

## New Files

### Main Process — `src/main/tmux/`

| File | Purpose |
|------|---------|
| `tmux-escape.ts` | `decodeOctalEscapes()` and `encodeToHex()` for tmux's `\NNN` octal encoding |
| `tmux-layout-parser.ts` | Parse tmux layout strings into `SplitNode` trees. `{...}` = left-right (our vertical), `[...]` = top-bottom (our horizontal). Convert N-ary to binary tree with ratio from child dimensions. |
| `tmux-protocol-parser.ts` | Line-buffered state machine: DCS detection → parse `%begin/%end/%error` response blocks, `%output %PANE DATA`, `%window-add`, `%window-close`, `%window-renamed`, `%layout-change`, `%exit`, etc. |
| `tmux-command-queue.ts` | FIFO queue that sends commands to the control PTY and correlates `%begin/%end` responses by sequence number. Returns `Promise<string[]>`. |
| `tmux-session.ts` | Orchestrator per connection. Owns parser + queue. Runs init sequence (list-windows → list-panes → capture-pane → refresh-client). Routes output. Handles notifications → IPC to tmux window. |
| `tmux-manager.ts` | Singleton registry of active `TmuxSession` instances keyed by control PTY ID. |

### Shared — `src/shared/`

| File | Purpose |
|------|---------|
| `tmux-ipc-channels.ts` | IPC channel constants for all tmux events |
| `tmux-types.ts` | `TmuxSessionInfo`, `TmuxWindowInfo`, `TmuxPaneInfo`, notification types |

### Renderer — `src/renderer/`

| File | Purpose |
|------|---------|
| `store/tmux.ts` | Zustand slice: `isTmuxWindow`, `tmuxSessionName`, `tmuxTriggerPtyId`, pane/window ID mappings |
| `components/Terminal/TmuxGatewayView.tsx` | Overlay for triggering terminal: session info, Esc/X key handlers |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/shared/types.ts` | Add `tmuxPaneId?: string` to SplitNode leaf |
| `src/main/pty-manager.ts` | In `onData` (line 39-43): detect `\033P1000p`, create TmuxSession, redirect subsequent data. Add `getPty()` accessor for command queue. |
| `src/main/ipc-handlers.ts` | Add handlers for `tmux:input`, `tmux:resize`, `tmux:new-window`, `tmux:split-pane`, `tmux:kill-pane`, `tmux:resize-pane`, `tmux:detach`, `tmux:force-quit` |
| `src/main/window-manager.ts` | Add `createTmuxWindow(sessionId)` passing `?tmux=SESSION_ID` query param |
| `src/preload/api.ts` | Add tmux methods to `TerminalAPI` interface |
| `src/preload/index.ts` | Implement tmux IPC bridge methods |
| `src/renderer/store/index.ts` | Add `TmuxSlice` to combined store |
| `src/renderer/App.tsx` | Detect tmux mode via URL param on mount; in tmux windows: build tabs/panes from tmux events; in normal windows: listen for `tmux:detected` to show gateway overlay |
| `src/renderer/components/Terminal/TerminalView.tsx` | Add `tmuxPaneId` prop; when set, route via `tmux:output`/`tmux:input` instead of `pty:output`/`pty:input` |
| `src/renderer/components/SplitPane/SplitContainer.tsx` | Pass `tmuxPaneId` from SplitNode leaf to TerminalView. In tmux mode, divider drag sends `tmux:resize-pane` instead of updating store ratio directly. |
| `src/renderer/components/SplitPane/SplitDivider.tsx` | Accept optional `isTmux` + `onTmuxResize` props. When tmux, compute column/row delta and call tmux resize callback. |
| `src/renderer/global.css` | Styles for TmuxGatewayView |

---

## Key Design Decisions

### 1. DCS Detection (`pty-manager.ts` line 39-43)
Buffer up to 8 bytes across `onData` chunks to detect `\033P1000p`. On detection: send pre-DCS data as normal output, then `tmuxManager.startSession(ptyId, window)`. All subsequent data for this PTY goes to the session.

### 2. Protocol Parser (line-buffered state machine)
- Accumulate raw data; split on `\n` (real newlines in `%output` are octal-escaped as `\012`, so `\n` always delimits protocol lines)
- Inside `%begin`...`%end`: accumulate lines as command response
- Outside: dispatch `%output`, `%window-add`, `%layout-change`, `%exit`, etc. as typed events

### 3. Layout String Parser
Format: `CHECKSUM,WxH,X,Y{children}` or `[children]`
- `{...}` = horizontal arrangement → our `direction: 'vertical'`
- `[...]` = vertical arrangement → our `direction: 'horizontal'`
- Leaf: `WxH,X,Y,PANE_ID`
- Convert N-ary to binary: `split(c1, split(c2, c3))`, ratio from child dimensions

### 4. Initialization Sequence (TmuxSession)
```
1. list-windows -F '#{window_id} #{window_name} #{window_layout} #{window_active}'
2. Per window: list-panes -t @W -F '#{pane_id} #{pane_width} #{pane_height} #{pane_active}'
3. Per pane: capture-pane -t %P -p -e -S -   (full scrollback with escape sequences)
4. refresh-client -C cols,rows
5. Buffer %output until scrollback delivered to renderer
6. Send tmux:session-ready → renderer builds tabs/panes
7. Per pane: send tmux:scrollback → written to xterm before live output
8. Flush buffered %output
```

### 5. TerminalView Dual Mode
`tmuxPaneId` prop switches data routing:
- **Set**: `handleData` → `writeTmuxPane(tmuxPaneId)`, output via `onTmuxOutput`, no per-pane resize IPC
- **Unset**: Normal `writePty`/`onPtyOutput`/`resizePty` flow (unchanged)

### 6. Triggering Terminal
- TerminalView checks `store.tmuxTriggerPtyId` — if it matches, render `TmuxGatewayView` overlay
- xterm stays alive underneath (preserves scrollback)
- On detach/exit: clear overlay, xterm resumes

### 7. Tmux Window Behavior — User Actions Route Through Tmux
In tmux windows, user actions (new tab, split, resize, close) are routed as tmux commands rather than handled locally. The UI responds to the resulting tmux notifications, keeping tmux as the source of truth:

| User Action | Tmux Command Sent | Notification That Updates UI |
|---|---|---|
| New Tab (Cmd+T) | `new-window` | `%window-add @ID` → add tab |
| Split Vertical (Cmd+D) | `split-window -h -t %PANE` | `%layout-change` → rebuild pane tree |
| Split Horizontal (Cmd+Shift+D) | `split-window -v -t %PANE` | `%layout-change` → rebuild pane tree |
| Close Pane (Cmd+W) | `kill-pane -t %PANE` | `%layout-change` or `%window-close` |
| Mouse drag divider | `resize-pane -t %PANE -x COLS` or `-y ROWS` | `%layout-change` → rebuild pane tree |
| Window resize | `refresh-client -C cols,rows` | `%layout-change` for all windows |

**Flow**: User action → IPC to main → TmuxSession sends command → tmux processes it → tmux sends notification → parser dispatches → renderer updates UI.

New IPC channels for user-initiated tmux actions:
- `tmux:new-window` (renderer→main) — triggers `new-window`
- `tmux:split-pane` (renderer→main) — `(tmuxPaneId, direction)` triggers `split-window`
- `tmux:kill-pane` (renderer→main) — `(tmuxPaneId)` triggers `kill-pane`
- `tmux:resize-pane` (renderer→main) — `(tmuxPaneId, direction, amount)` triggers `resize-pane`

The split dividers work the same as normal mode visually, but instead of updating the local store ratio, they compute the delta in rows/columns and send a `tmux:resize-pane` command. The store is updated when the `%layout-change` notification comes back.

---

## IPC Channels

| Channel | Direction | Payload |
|---------|-----------|---------|
| `tmux:detected` | main→trigger renderer | `(ptyId, sessionName)` |
| `tmux:session-ready` | main→tmux renderer | `(TmuxSessionInfo)` |
| `tmux:output` | main→tmux renderer | `(tmuxPaneId, decodedData)` |
| `tmux:scrollback` | main→tmux renderer | `(tmuxPaneId, data)` |
| `tmux:tab-add` | main→tmux renderer | `(TmuxWindowInfo)` |
| `tmux:tab-close` | main→tmux renderer | `(tmuxWindowId)` |
| `tmux:tab-renamed` | main→tmux renderer | `(tmuxWindowId, name)` |
| `tmux:layout-change` | main→tmux renderer | `(tmuxWindowId, SplitNode)` |
| `tmux:exit` | main→both renderers | `()` |
| `tmux:input` | tmux renderer→main | `(tmuxPaneId, data)` |
| `tmux:resize` | tmux renderer→main | `(cols, rows)` |
| `tmux:new-window` | tmux renderer→main | `()` |
| `tmux:split-pane` | tmux renderer→main | `(tmuxPaneId, direction)` |
| `tmux:kill-pane` | tmux renderer→main | `(tmuxPaneId)` |
| `tmux:resize-pane` | tmux renderer→main | `(tmuxPaneId, direction, amount)` |
| `tmux:detach` | trigger renderer→main | `(ptyId)` |
| `tmux:force-quit` | trigger renderer→main | `(ptyId)` |

---

## Implementation Steps

### Step 1: Shared types and IPC channels
- Create `src/shared/tmux-types.ts` and `src/shared/tmux-ipc-channels.ts`
- Add `tmuxPaneId?: string` to SplitNode leaf in `src/shared/types.ts`

### Step 2: Tmux escape utilities + unit tests
- Create `src/main/tmux/tmux-escape.ts`
- Create `tests/unit/tmux-escape.spec.ts`

### Step 3: Layout parser + unit tests
- Create `src/main/tmux/tmux-layout-parser.ts`
- Create `tests/unit/tmux-layout-parser.spec.ts` (single pane, 2-way, 3-way, deeply nested)

### Step 4: Protocol parser + unit tests
- Create `src/main/tmux/tmux-protocol-parser.ts`
- Create `tests/unit/tmux-protocol-parser.spec.ts`

### Step 5: Command queue + unit tests
- Create `src/main/tmux/tmux-command-queue.ts`
- Create `tests/unit/tmux-command-queue.spec.ts`

### Step 6: TmuxSession + TmuxManager
- Create `src/main/tmux/tmux-session.ts` (init sequence, notification routing, sendKeys, refreshClient, detach)
- Create `src/main/tmux/tmux-manager.ts` (singleton registry)

### Step 7: Main process integration
- Modify `src/main/pty-manager.ts` — DCS detection + data redirect
- Modify `src/main/ipc-handlers.ts` — tmux IPC handlers
- Modify `src/main/window-manager.ts` — `createTmuxWindow()`

### Step 8: Preload + store
- Extend `src/preload/api.ts` and `src/preload/index.ts`
- Create `src/renderer/store/tmux.ts`, integrate into `src/renderer/store/index.ts`

### Step 9: Renderer — TmuxGatewayView + TerminalView changes
- Create `src/renderer/components/Terminal/TmuxGatewayView.tsx`
- Modify `TerminalView.tsx` — add `tmuxPaneId` prop
- Modify `SplitContainer.tsx` — pass `tmuxPaneId`
- Add CSS for gateway overlay in `global.css`

### Step 10: Renderer — App.tsx tmux window mode
- Detect `?tmux=SESSION_ID` on mount
- Listen for `tmux:session-ready` → build tabs/panes
- Listen for dynamic notifications (tab-add/close/renamed, layout-change, exit)
- Handle scrollback loading before live output
- Triggering window: `tmux:detected` → gateway overlay

### Step 11: Testing
- Run all unit tests: `pnpm test`
- Manual verification with `tmux -CC`

---

## Verification Plan

1. `pnpm test` — all existing 24 tests + new tmux tests pass
2. `pnpm build` — builds without errors
3. `tmux -CC new -s test` → new window, one tab, one pane, shell works, vim/htop render
4. Attach to session with splits → panes render with correct layout
5. `tmux new-window` from another client → new tab appears
6. Scrollback visible on attach
7. Resize tmux window → panes re-layout
8. Esc in triggering terminal → clean detach, tmux window closes
9. X in triggering terminal → force-quit
10. Cmd+T in tmux window → new tmux window created, new tab appears
11. Cmd+D in tmux window → pane splits, layout updates
12. Mouse drag divider in tmux window → panes resize via tmux
13. Close pane in tmux window → pane removed, layout updates
14. `ssh host && tmux -CC a` → works identically
15. Normal terminals unaffected
