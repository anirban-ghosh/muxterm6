export const TMUX_IPC = {
  // main -> trigger renderer
  DETECTED: 'tmux:detected',

  // main -> tmux renderer
  SESSION_READY: 'tmux:session-ready',
  OUTPUT: 'tmux:output',
  SCROLLBACK: 'tmux:scrollback',
  TAB_ADD: 'tmux:tab-add',
  TAB_CLOSE: 'tmux:tab-close',
  TAB_RENAMED: 'tmux:tab-renamed',
  LAYOUT_CHANGE: 'tmux:layout-change',
  EXIT: 'tmux:exit',

  // tmux renderer -> main
  INPUT: 'tmux:input',
  RESIZE: 'tmux:resize',
  PANE_RESIZED: 'tmux:pane-resized',
  NEW_WINDOW: 'tmux:new-window',
  SPLIT_PANE: 'tmux:split-pane',
  KILL_PANE: 'tmux:kill-pane',
  RESIZE_PANE: 'tmux:resize-pane',

  // trigger renderer -> main
  DETACH: 'tmux:detach',
  FORCE_QUIT: 'tmux:force-quit'
} as const
