Implement the following plan:

# SFTP Browser Feature Plan

## Context

Add a two-pane SFTP file browser to MuxTerm. Opens as a separate window from the App Menu (Shell -> SFTP Browser). Left pane = local files (starting at `$HOME`), right pane = remote files via SSH/SFTP. Supports drag-drop transfers, copy/cut/paste, rsync-based transfers with progress, SSH config host discovery, and interactive auth flows (host key verification, password prompts).

---

## New Dependencies

```
ssh2-sftp-client ^11.0.0
```

---

## New Files

### Shared -- src/shared/
| File | Purpose |
|------|---------|
| sftp-ipc-channels.ts | IPC channel constants for all SFTP operations |
| sftp-types.ts | FileEntry, SshHostConfig, ConnectionConfig, TransferRequest, TransferProgress, ConflictResolution, HostKeyInfo |

### Main Process -- src/main/sftp/
| File | Purpose |
|------|---------|
| ssh-config-parser.ts | Parse ~/.ssh/config -> SshHostConfig[] (skip wildcards, expand ~ in IdentityFile) |
| local-file-service.ts | Wrapper over Node.js fs: list (with hidden files), rename, copy (recursive), delete, mkdir, exists, openFile (shell.openPath) |
| sftp-connection-manager.ts | Singleton managing ssh2-sftp-client connections keyed by sftp-${windowId}. Connect with host key verify + password callbacks, list, rename, delete, mkdir, exists, home dir, disconnect |
| rsync-transfer-service.ts | Spawn rsync -avz --progress -e "ssh -p PORT -i KEY". Parse progress output (bytes, %, speed). Send progress events via IPC. Cancel via SIGTERM. Password auth uses sshpass -p prefix. Fallback to ssh2-sftp-client fastPut/fastGet if rsync unavailable |
| sftp-ipc-handlers.ts | Register all SFTP IPC handlers |

### Preload -- src/preload/
| File | Purpose |
|------|---------|
| sftp-api.ts | SftpAPI interface + types. Exposed as window.sftpAPI via separate contextBridge.exposeInMainWorld call |

### Renderer -- src/renderer/components/SftpBrowser/
| File | Purpose |
|------|---------|
| SftpBrowser.tsx | Root component: TitleBar + ConnectionBar + two-pane layout + TransferProgressBar + modal dialogs |
| ConnectionBar.tsx | Connection status, connect/disconnect buttons |
| ConnectionDialog.tsx | Dropdown of SSH config hosts + custom server form (hostname, port, username, SSH key, remote path) |
| AddressBar.tsx | Editable path input per pane. Enter -> navigate, blur -> revert if invalid |
| FileBrowser.tsx | Reusable for both sides. File list with icon/name/size/date/permissions. ".." at top. Click/Ctrl+click/Shift+click selection. Double-click dir -> navigate. Double-click local file -> open. Double-click remote file -> download. Drag-drop intra-pane = move, inter-pane = rsync transfer. Context menu + Cmd+C/X/V |
| HostKeyDialog.tsx | Host fingerprint, Accept/Reject -> sftpAPI.respondHostKey() |
| PasswordDialog.tsx | Password input -> sftpAPI.respondPassword() |
| ConflictDialog.tsx | File exists -> Cancel / Overwrite / Rename (copy_XXX_of_{FILENAME}) |
| TransferProgressBar.tsx | Bottom bar: active transfers with filename, progress bar, %, speed, cancel |

### Store -- src/renderer/store/
| File | Purpose |
|------|---------|
| sftp.ts | Standalone Zustand store (useSftpStore, NOT merged into AppStore). Connection state, local/remote path + files + loading + selection, clipboard, transfers, dialog state |

---

## Files to Modify
| File | Changes |
|------|---------|
| package.json | Add ssh2-sftp-client |
| src/main/index.ts | Import and call registerSftpIpcHandlers() |
| src/main/window-manager.ts | Add createSftpWindow(): 1100x700, min 700x400, ?sftp=true query param, disconnect SFTP on close |
| src/main/menu.ts | Add "SFTP Browser" under Shell submenu, CmdOrCtrl+Shift+S, calls windowManager.createSftpWindow() |
| src/preload/index.ts | Add contextBridge.exposeInMainWorld('sftpAPI', sftpApi) |
| src/renderer/App.tsx | Detect ?sftp=true -> early return <SftpBrowser /> (same pattern as tmux detection) |
| src/renderer/global.css | SFTP styles using existing CSS variables |

---

## Key Design Decisions
1. Separate window.sftpAPI from window.terminalAPI -- clean domain separation
2. Standalone Zustand store -- SFTP windows never need tabs/panes/terminal state
3. One connection per window -- connection ID = sftp-${windowId}. Disconnect/reconnect or open new window for different server
4. Host key verification via IPC round-trip -- main process ssh2 hostVerifier blocks on Promise, renderer shows dialog, user responds, Promise resolves
5. rsync with fallback -- rsync for transfers (archive mode, progress). Fallback to ssh2-sftp-client fastPut/fastGet if rsync/sshpass unavailable
6. Conflict naming -- copy_XXX_of_{FILENAME} with sequential counter scanning existing files
7. Always show hidden files -- no toggle, both readdir and SFTP list include dotfiles

---

## IPC Channels
| Channel | Direction | Pattern |
|---------|-----------|---------|
| `sftp:parse-ssh-config` | R→M | invoke → `SshHostConfig[]` |
| `sftp:connect` | R→M | invoke(ConnectionConfig) → connectionId |
| `sftp:disconnect` | R→M | invoke |
| `sftp:remote-list` | R→M | invoke(path) → `FileEntry[]` |
| `sftp:remote-rename` | R→M | invoke(old, new) |
| `sftp:remote-delete` | R→M | invoke(path, isDir) |
| `sftp:remote-mkdir` | R→M | invoke(path) |
| `sftp:remote-exists` | R→M | invoke(path) → `false \| 'd' \| '-'` |
| `sftp:remote-home` | R→M | invoke → path string |
| `sftp:local-list` | R→M | invoke(path) → `FileEntry[]` |
| `sftp:local-rename` | R→M | invoke(old, new) |
| `sftp:local-copy` | R→M | invoke(src, dest) |
| `sftp:local-delete` | R→M | invoke(path, isDir) |
| `sftp:local-mkdir` | R→M | invoke(path) |
| `sftp:local-exists` | R→M | invoke(path) → `false \| 'd' \| '-'` |
| `sftp:local-home` | R→M | invoke → path string |
| `sftp:local-open-file` | R→M | invoke(path) |
| `sftp:transfer-start` | R→M | invoke(TransferRequest) |
| `sftp:transfer-cancel` | R→M | send(transferId) |
| `sftp:transfer-progress` | M→R | event(TransferProgress) |
| `sftp:transfer-complete` | M→R | event(transferId) |
| `sftp:transfer-error` | M→R | event(transferId, error) |
| `sftp:host-key-verify` | M→R | event(HostKeyInfo) |
| `sftp:host-key-response` | R→M | send(accepted) |
| `sftp:password-prompt` | M→R | event() |
| `sftp:password-response` | R→M | send(password) |
| `sftp:window-new` | R→M | send() |

---

## Implementation Steps

### Phase 1: Foundation
1. Create `src/shared/sftp-types.ts` and `src/shared/sftp-ipc-channels.ts`
2. `pnpm add ssh2-sftp-client` + `pnpm add -D @types/ssh2-sftp-client` (if available)
3. Add `createSftpWindow()` to `src/main/window-manager.ts`
4. Add "SFTP Browser" menu item to `src/main/menu.ts`

### Phase 2: Main Process Services
5. Create `src/main/sftp/ssh-config-parser.ts`
6. Create `src/main/sftp/local-file-service.ts`
7. Create `src/main/sftp/sftp-connection-manager.ts`
8. Create `src/main/sftp/rsync-transfer-service.ts`
9. Create `src/main/sftp/sftp-ipc-handlers.ts`
10. Register handlers in `src/main/index.ts`

### Phase 3: Preload Bridge
11. Create `src/preload/sftp-api.ts`
12. Add SFTP bridge to `src/preload/index.ts`

### Phase 4: Renderer — Core UI
13. Create `src/renderer/store/sftp.ts`
14. Create `SftpBrowser.tsx` (root layout)
15. Create `ConnectionDialog.tsx`
16. Create `ConnectionBar.tsx`
17. Create `AddressBar.tsx`
18. Create `FileBrowser.tsx` (file listing, navigation, selection)
19. Modify `App.tsx` — detect `?sftp=true`, render `<SftpBrowser />`
20. Add CSS to `global.css`

### Phase 5: Auth Dialogs
21. Create `HostKeyDialog.tsx`
22. Create `PasswordDialog.tsx`

### Phase 6: Transfers & Drag-Drop
23. Create `TransferProgressBar.tsx`
24. Create `ConflictDialog.tsx`
25. Add drag-and-drop to `FileBrowser.tsx` (intra-pane move, inter-pane transfer)
26. Add clipboard operations (Cmd+C/X/V) to `FileBrowser.tsx`

### Phase 7: Polish
27. Error handling, loading states, edge cases
28. Test with real SSH servers

---

## Verification Plan

1. `pnpm build` — builds without errors
2. Shell menu → "SFTP Browser" (Cmd+Shift+S) opens new two-pane window
3. SSH config hosts appear in connection dropdown
4. Connect to SSH server → host key dialog if first time → remote files listed
5. Password auth flow works when key auth unavailable
6. Address bar navigation works on both panes
7. Double-click directory navigates, updates address bar
8. Double-click local file opens in system app
9. Double-click remote file downloads to local
10. Drag file from local to remote → rsync transfer with progress bar
11. Drag file from remote to local → rsync download with progress bar
12. Drag within same pane → move operation
13. Copy conflict → dialog with cancel/overwrite/rename options
14. Cmd+C/X/V within pane and across panes
15. Transfer progress bar shows filename, %, speed
16. Cancel button stops active transfer
17. Hidden files visible on both sides
18. Disconnect and reconnect works cleanly
