export const IPC = {
  PTY_CREATE: 'pty:create',
  PTY_DESTROY: 'pty:destroy',
  PTY_RESIZE: 'pty:resize',
  PTY_INPUT: 'pty:input',
  PTY_OUTPUT: 'pty:output',
  PTY_EXIT: 'pty:exit',
  PTY_TITLE: 'pty:title',
  WINDOW_NEW: 'window:new'
} as const
