import { describe, it, expect } from 'vitest'
import { decodeOctalEscapes, encodeToHex } from '../../src/main/tmux/tmux-escape'

describe('decodeOctalEscapes', () => {
  it('should decode \\012 as newline', () => {
    expect(decodeOctalEscapes('hello\\012world')).toBe('hello\nworld')
  })

  it('should decode \\134 as backslash', () => {
    expect(decodeOctalEscapes('path\\134file')).toBe('path\\file')
  })

  it('should decode multiple escapes', () => {
    expect(decodeOctalEscapes('a\\012b\\012c')).toBe('a\nb\nc')
  })

  it('should handle string with no escapes', () => {
    expect(decodeOctalEscapes('hello world')).toBe('hello world')
  })

  it('should decode \\033 as ESC', () => {
    expect(decodeOctalEscapes('\\033[31m')).toBe('\x1b[31m')
  })

  it('should handle empty string', () => {
    expect(decodeOctalEscapes('')).toBe('')
  })

  it('should decode null byte \\000', () => {
    expect(decodeOctalEscapes('\\000')).toBe('\0')
  })
})

describe('encodeToHex', () => {
  it('should encode ASCII characters', () => {
    expect(encodeToHex('A')).toBe('41')
  })

  it('should encode multiple characters with spaces', () => {
    expect(encodeToHex('AB')).toBe('41 42')
  })

  it('should encode newline', () => {
    expect(encodeToHex('\n')).toBe('0a')
  })

  it('should encode empty string', () => {
    expect(encodeToHex('')).toBe('')
  })

  it('should encode special characters', () => {
    expect(encodeToHex('\x1b')).toBe('1b')
  })

  it('should encode multi-byte UTF-8', () => {
    // Unicode char with multi-byte encoding
    const hex = encodeToHex('\u00e9') // é
    expect(hex).toBe('c3 a9')
  })
})
