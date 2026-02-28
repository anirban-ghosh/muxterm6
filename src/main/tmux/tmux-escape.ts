/**
 * Tmux control mode uses octal escapes for special characters in %output lines.
 * Real newlines in output are encoded as \012, backslashes as \134, etc.
 * Protocol-level newlines (\n) always delimit protocol lines.
 */

/**
 * Decode tmux octal escape sequences (\NNN) in a string.
 * Tmux encodes bytes as 3-digit octal: \012 = newline, \134 = backslash, etc.
 */
export function decodeOctalEscapes(input: string): string {
  return input.replace(/\\(\d{3})/g, (_match, octal: string) => {
    return String.fromCharCode(parseInt(octal, 8))
  })
}

/**
 * Encode a string of keystrokes into tmux send-keys -H hex format.
 * Each byte becomes a two-digit hex string: 'A' -> '41'
 */
export function encodeToHex(data: string): string {
  const hexParts: string[] = []
  const buf = Buffer.from(data, 'utf-8')
  for (let i = 0; i < buf.length; i++) {
    hexParts.push(buf[i].toString(16).padStart(2, '0'))
  }
  return hexParts.join(' ')
}
