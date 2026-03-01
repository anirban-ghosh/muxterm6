Implement the following plan:

# MuxTerm - Modern Terminal Emulator Implementation Plan

## Context

Building a fully-featured terminal emulator from scratch in a blank directory. The app must support full terminal emulation (ncurses, vim, htop, colors), tabs, multiple windows, nested split panes with mouse resize, and a modern minimal aesthetic (Warp/Ghostty style). Cross-platform: macOS + Linux.

## Technology Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Electron | 40.x |
| Terminal | @xterm/xterm | 6.x |
| Shell bridge | node-pty | 1.x |
| UI | React 18 + TypeScript | |
| State | Zustand | 5.x |
| Bundler | electron-vite | 3.x |
| Styling | CSS custom properties (no CSS-in-JS) | |
| Packaging | electron-builder | 25.x |
| Unit tests | Vitest | 3.x |
| E2E tests | Playwright (Electron support) | 1.50.x |
| Logging | pino | 9.x |
| Package manager | pnpm | |

### xterm.js Addons
- @xterm/addon-fit, @xterm/addon-webgl, @xterm/addon-web-links, @xterm/addon-unicode11, @xterm/addon-image, @xterm/addon-serialize

## Project Structure

```
muxterm/
  src/
    main/           # Electron main process
      index.ts      # App lifecycle, window creation
      pty-manager.ts # node-pty process management
      ipc-handlers.ts # IPC channel handlers
      menu.ts       # Native menu (File, Edit, Shell, Window, Help)
      window-manager.ts # Multi-window management
    preload/
      index.ts      # contextBridge API
      api.ts        # TypeScript interface for renderer API
    renderer/
      App.tsx        # Root component
      components/
        Terminal/
          TerminalView.tsx    # xterm.js wrapper
          useTerminal.ts      # Hook: xterm init, fit, addons
        TabBar/
          TabBar.tsx          # Tab strip
          Tab.tsx             # Single tab
        SplitPane/
          SplitContainer.tsx  # Recursive split renderer
          SplitDivider.tsx    # Draggable divider
        StatusBar/
          StatusBar.tsx       # Bottom bar (shell, size)
        TitleBar/
          TitleBar.tsx        # Custom titlebar (macOS traffic lights spacer)
      store/
        index.ts              # Zustand store (tabs, panes, splits)
      global.css              # All styles (CSS variables)
      index.html
      main.tsx
    shared/
      types.ts                # SplitNode, Tab, Pane types
  tests/
    unit/                     # Vitest unit tests
    e2e/                      # Playwright E2E tests
  electron-builder.yml
  electron.vite.config.ts
  tsconfig.json / tsconfig.node.json / tsconfig.web.json
  package.json
  vitest.config.ts
```

## Core Architecture

### Split Pane Data Model (discriminated union tree)
```typescript
type SplitNode =
  | { type: 'leaf'; paneId: string; ptyId: string }
  | { type: 'split'; direction: 'horizontal' | 'vertical'; ratio: number;
      first: SplitNode; second: SplitNode };
```

- `direction: 'vertical'` = side-by-side (left | right), divider is vertical line
- `direction: 'horizontal'` = stacked (top / bottom), divider is horizontal line
- `ratio`: 0-1, proportion of first child

### IPC Protocol
| Channel | Direction | Payload |
|---------|-----------|---------|
| `pty:create` | R→M | `{ cols, rows, shell? }` → `ptyId` |
| `pty:input` | R→M | `{ ptyId, data }` |
| `pty:output` | M→R | `{ ptyId, data }` |
| `pty:resize` | R→M | `{ ptyId, cols, rows }` |
| `pty:exit` | M→R | `{ ptyId, exitCode }` |

### Shell Integration
- Detect user's default shell from `$SHELL` env var
- Pass `TERM=xterm-256color`, `COLORTERM=truecolor`

### Key Implementation Details
1. **One xterm per leaf pane** — each gets its own xterm.js Terminal instance
2. **One PTY per leaf pane** — node-pty process, 1:1 with xterm
3. **Fit on resize** — `addon-fit` recalculates cols/rows, sends `pty:resize`
4. **WebGL renderer** — `addon-webgl` for GPU-accelerated rendering
5. **Split divider drag** — updates `ratio` in store, triggers re-render + fit
6. **Tab close** — kills all PTYs in tab's split tree

### Visual Style
- Dark background: `#0f0f1a`
- Minimal chrome, no borders between panes (1px subtle divider)
- macOS: hide native titlebar, custom titlebar with traffic-light spacer
- Tab bar integrated into titlebar area
- Status bar: shell name, terminal size

## Implementation Phases

### Phase 1: Scaffold + Single Terminal
1. Initialize project: `pnpm create electron-vite muxterm`
2. Configure TypeScript, Vitest, electron-vite
3. Create `pty-manager.ts` — spawn, write, resize, kill
4. Create `ipc-handlers.ts` — register all channels
5. Create `TerminalView.tsx` + `useTerminal.ts` — xterm with addons
6. Create `global.css` — dark theme variables
7. **Verify**: Single terminal, full color, vim works, auto-resize

### Phase 2: Tabs
8. Create `store/index.ts` — Zustand with tabs, active tab, panes
9. Create `TabBar.tsx` + `Tab.tsx`
10. Create `TitleBar.tsx` with macOS spacer
11. Wire Cmd+T (new tab), Cmd+W (close tab), Cmd+Shift+[ / ] (switch tabs)
12. **Verify**: Multiple tabs, switching, closing, shell exit closes tab

### Phase 3: Split Panes
13. Create `shared/types.ts` — `SplitNode` type
14. Create `SplitContainer.tsx` — recursive renderer
15. Create `SplitDivider.tsx` — mouse drag to resize
16. Wire Cmd+D (vertical split), Cmd+Shift+D (horizontal split)
17. Focus management — click pane to focus, visual indicator
18. **Verify**: Splits work, resize works, focus indicator, nested splits

### Phase 4: Multi-Window + Menu
19. Create `window-manager.ts` — track windows, create new
20. Create `menu.ts` — native menu with all shortcuts
21. Wire Cmd+N (new window)
22. **Verify**: Multiple windows, each independent

### Phase 5: Polish
23. Create `StatusBar.tsx` — shell name, terminal size
24. Add WebGL renderer with fallback
25. Web links addon (clickable URLs)
26. Unicode support
27. Image protocol support
28. **Verify**: Status bar updates, links clickable, images render

### Phase 6: Testing
29. Unit tests for `SplitNode` operations (add, remove, resize)
30. Unit tests for store actions
31. E2E tests: launch app, verify terminal renders, type command, check output
32. **Verify**: All tests pass

## Verification Plan
1. `pnpm build` compiles without errors
2. App launches, single terminal works (ls, vim, htop, colors)
3. Tabs: create, switch, close, shell-exit-closes-tab
4. Splits: vertical, horizontal, nested, resize with mouse
5. Multiple windows work independently
6. All tests pass: `pnpm test`
