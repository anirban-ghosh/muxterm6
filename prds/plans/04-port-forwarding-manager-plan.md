# Port Forwarding Manager — Implementation Plan

## Context

Add an SSH port forwarding manager to MuxTerm as an independent window (like the SFTP browser). Supports local (`-L`), remote (`-R`), and dynamic SOCKS (`-D`) tunnels. Tunnels persist across manager window open/close and are only destroyed explicitly or on app quit.

---

## Architecture

Follows the exact SFTP browser pattern: dedicated window via query param, separate IPC channels, separate Zustand store, singleton backend manager.

**Key difference from SFTP**: Tunnels are NOT tied to a window. The `TunnelManager` singleton lives in the main process and persists regardless of whether the UI window is open. The manager window is purely a view.

Uses raw `ssh2.Client` (already installed as transitive dep of `ssh2-sftp-client`) for SSH connections, and Node.js `net.createServer` for local TCP listeners.

---

## Files to Create (11)

### 1. `src/shared/tunnel-types.ts`
Types shared across all processes:
- `TunnelType = 'local' | 'remote' | 'dynamic'`
- `TunnelStatus = 'connecting' | 'active' | 'paused' | 'error'`
- `TunnelConfig` — SSH connection + tunnel parameters
- `TunnelInfo` — full tunnel state (config + status + stats) sent to renderer

Import `SshHostConfig` and `HostKeyInfo` from `sftp-types.ts` (re-export them, no duplication).

### 2. `src/shared/tunnel-ipc-channels.ts`
IPC channel constants: `TUNNEL_IPC` object with channels for CREATE, DESTROY, PAUSE, RESUME, LIST, STATUS_UPDATE, STATS_UPDATE, auth flow (HOST_KEY_VERIFY/RESPONSE, PASSWORD_PROMPT/RESPONSE), PARSE_SSH_CONFIG, WINDOW_NEW.

### 3. `src/main/tunnel/tunnel-manager.ts`
Core singleton class managing all tunnels:
- `tunnels: Map<string, ManagedTunnel>` keyed by UUID
- `createTunnel(config, authWindow)` — connects SSH, sets up forwarding
- `destroyTunnel(id)` — closes server/SSH, removes from map
- `pauseTunnel(id)` — closes local server, keeps SSH alive, status → paused
- `resumeTunnel(id)` — re-creates local server, status → active
- `listTunnels()` — returns `TunnelInfo[]`
- `destroyAll()` — graceful shutdown of everything
- `setManagerWindow(id)` — tracks open manager window for push events

Internal methods:
- `connectSSH(config, authWindow)` — SSH auth with host key verify + password prompt via IPC round-trip (reuses pattern from `sftp-connection-manager.ts`)
- `setupLocalForward(tunnel)` — `net.createServer` → `client.forwardOut()` piping
- `setupRemoteForward(tunnel)` — `client.forwardIn()` + `tcp connection` event → local `net.connect()` piping
- `setupDynamicForward(tunnel)` — minimal SOCKS5 server → `client.forwardOut()` piping
- `notifyStatusUpdate(tunnel)` — push `TunnelInfo` to manager window if open

### 4. `src/main/tunnel/tunnel-ipc-handlers.ts`
`registerTunnelIpcHandlers()` function registering `ipcMain.handle` for all channels. Reuses `parseSshConfig` from `src/main/sftp/ssh-config-parser.ts`.

### 5. `src/preload/tunnel-api.ts`
`TunnelAPI` interface + `Window` type augmentation. Mirrors `sftp-api.ts` pattern.

### 6. `src/renderer/store/tunnel.ts`
Zustand store: `tunnels: TunnelInfo[]`, `showAddDialog`, `hostKeyInfo`, `showPasswordDialog`, loading state, and setter actions. `updateTunnel` upserts by ID, `removeTunnel` filters out.

### 7. `src/renderer/components/TunnelManager/TunnelManager.tsx`
Main component:
- On mount: `listTunnels()` to hydrate state
- Subscribes to `onStatusUpdate` and `onStatsUpdate` events
- Subscribes to auth events (host key, password) — reuses `HostKeyDialog` and `PasswordDialog` from SFTP
- Renders toolbar with "Add Tunnel" button + `TunnelTable` + `AddTunnelDialog` overlay

### 8. `src/renderer/components/TunnelManager/TunnelTable.tsx`
Table with columns: Type (badge L/R/D), Host, SSH Port, Local Port, Remote Host:Port, Status (colored badge), Connections, Actions (pause/resume + destroy buttons).
Empty state when no tunnels.

### 9. `src/renderer/components/TunnelManager/AddTunnelDialog.tsx`
Overlay dialog:
- SSH connection: hostname, port, username, identity file, or select from `~/.ssh/config`
- Tunnel type: three toggle buttons (Local/Remote/Dynamic)
- Port config fields that change based on type
- `TunnelDiagram` component showing visual topology
- Start button

### 10. `src/renderer/components/TunnelManager/TunnelDiagram.tsx`
Visual CSS-based diagram (like MobaXterm) that updates reactively as user fills in fields:
- **Local**: `[Your Machine :localPort] ──SSH──▶ [SSH Server] ──▶ [remoteHost:remotePort]`
- **Remote**: `[Remote Client] ──▶ [SSH Server :remotePort] ──SSH──▶ [Your Machine :localPort]`
- **Dynamic**: `[Your Machine :localPort (SOCKS5)] ──SSH──▶ [SSH Server] ──▶ [Any Destination]`

### 11. `tests/unit/tunnel-manager.spec.ts`
Unit tests for TunnelManager: create/destroy/pause/resume/list/destroyAll, mocking ssh2.Client, net, electron, fs/promises.

---

## Files to Modify (6)

### 12. `src/main/window-manager.ts`
Add `createTunnelWindow()`: 800x500 window with `?tunnel=true` query param. Single-instance — if window already exists, focus it instead of creating new.

### 13. `src/main/menu.ts`
Add menu item in Shell submenu after SFTP Browser:
```
{ label: 'Port Forwarding', accelerator: 'CmdOrCtrl+Shift+F', click: () => windowManager.createTunnelWindow() }
```

### 14. `src/main/index.ts`
- Import and call `registerTunnelIpcHandlers()`
- Add `app.on('before-quit')` handler that calls `tunnelManager.destroyAll()`

### 15. `src/preload/index.ts`
Add `tunnelApi` contextBridge block exposing `window.tunnelAPI` (same pattern as sftpApi).

### 16. `src/renderer/App.tsx`
Add `isTunnelWindow()` check + early return with `<TunnelManager />`.

### 17. `src/renderer/global.css`
Add tunnel-specific styles: `.tunnel-app`, `.tunnel-toolbar`, `.tunnel-table`, `.tunnel-table__row`, `.tunnel-status--*`, `.tunnel-type-badge--*`, `.tunnel-action-btn`, `.tunnel-diagram`, `.tunnel-diagram__box`, `.tunnel-diagram__arrow`, `.tunnel-empty`.

---

## Implementation Order

1. Shared types + IPC channels (no deps)
2. `tunnel-manager.ts` (core backend)
3. `tunnel-ipc-handlers.ts`
4. `tunnel-api.ts` (preload type)
5. Modify `preload/index.ts` (add bridge)
6. Modify `window-manager.ts` (add createTunnelWindow)
7. Modify `menu.ts` (add menu item)
8. Modify `index.ts` (register handlers + before-quit)
9. Zustand store
10. UI components (TunnelManager, TunnelTable, AddTunnelDialog, TunnelDiagram)
11. Modify `App.tsx` (routing)
12. CSS styles
13. Unit tests

---

## Reused Code

| What | From |
|------|------|
| SSH config parsing | `src/main/sftp/ssh-config-parser.ts` — `parseSshConfig()` |
| Host key dialog | `src/renderer/components/SftpBrowser/HostKeyDialog.tsx` |
| Password dialog | `src/renderer/components/SftpBrowser/PasswordDialog.tsx` |
| `HostKeyInfo`, `SshHostConfig` types | `src/shared/sftp-types.ts` |
| Dialog/button CSS classes | `sftp-dialog-overlay`, `sftp-dialog`, `sftp-btn` in `global.css` |
| SSH auth flow pattern | `src/main/sftp/sftp-connection-manager.ts` (host key verify + password prompt IPC round-trip) |

---

## Verification

1. `pnpm build` — builds clean
2. `pnpm test` — all unit tests pass (existing + new tunnel-manager tests)
3. Manual: Shell > Port Forwarding (Cmd+Shift+F) opens manager window
4. Manual: Add Tunnel → Local tunnel → verify local port listens, data flows through SSH
5. Manual: Add Tunnel → Remote tunnel → verify remote port binds on server
6. Manual: Add Tunnel → Dynamic tunnel → verify SOCKS5 proxy works
7. Manual: Pause/resume tunnel → local server stops/restarts
8. Manual: Destroy tunnel → fully cleaned up
9. Manual: Close manager window → tunnels stay alive
10. Manual: Re-open manager window → shows existing tunnels
11. Manual: Cmd+Q → all tunnels gracefully closed
