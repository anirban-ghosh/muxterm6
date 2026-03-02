export const TUNNEL_IPC = {
  // Renderer -> Main (invoke)
  CREATE: 'tunnel:create',
  DESTROY: 'tunnel:destroy',
  PAUSE: 'tunnel:pause',
  RESUME: 'tunnel:resume',
  LIST: 'tunnel:list',
  PARSE_SSH_CONFIG: 'tunnel:parse-ssh-config',

  // Main -> Renderer (events)
  STATUS_UPDATE: 'tunnel:status-update',

  // Auth flow
  HOST_KEY_VERIFY: 'tunnel:host-key-verify',
  HOST_KEY_RESPONSE: 'tunnel:host-key-response',
  PASSWORD_PROMPT: 'tunnel:password-prompt',
  PASSWORD_RESPONSE: 'tunnel:password-response',

  // Window
  WINDOW_NEW: 'tunnel:window-new'
} as const
