export const SFTP_IPC = {
  // Renderer -> Main (invoke)
  PARSE_SSH_CONFIG: 'sftp:parse-ssh-config',
  CONNECT: 'sftp:connect',
  DISCONNECT: 'sftp:disconnect',

  REMOTE_LIST: 'sftp:remote-list',
  REMOTE_RENAME: 'sftp:remote-rename',
  REMOTE_DELETE: 'sftp:remote-delete',
  REMOTE_MKDIR: 'sftp:remote-mkdir',
  REMOTE_EXISTS: 'sftp:remote-exists',
  REMOTE_HOME: 'sftp:remote-home',

  LOCAL_LIST: 'sftp:local-list',
  LOCAL_RENAME: 'sftp:local-rename',
  LOCAL_COPY: 'sftp:local-copy',
  LOCAL_DELETE: 'sftp:local-delete',
  LOCAL_MKDIR: 'sftp:local-mkdir',
  LOCAL_EXISTS: 'sftp:local-exists',
  LOCAL_HOME: 'sftp:local-home',
  LOCAL_OPEN_FILE: 'sftp:local-open-file',

  // Transfers
  TRANSFER_START: 'sftp:transfer-start',
  TRANSFER_CANCEL: 'sftp:transfer-cancel',

  // Main -> Renderer (events)
  TRANSFER_PROGRESS: 'sftp:transfer-progress',
  TRANSFER_COMPLETE: 'sftp:transfer-complete',
  TRANSFER_ERROR: 'sftp:transfer-error',

  // Auth flow
  HOST_KEY_VERIFY: 'sftp:host-key-verify',
  HOST_KEY_RESPONSE: 'sftp:host-key-response',
  PASSWORD_PROMPT: 'sftp:password-prompt',
  PASSWORD_RESPONSE: 'sftp:password-response',

  // Window
  WINDOW_NEW: 'sftp:window-new'
} as const
