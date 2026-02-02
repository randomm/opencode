// Raw ANSI terminal utilities - zero dependencies

export const ESC = "\x1b"

export const cursor = {
  save: `${ESC}[s`,
  restore: `${ESC}[u`,
  hide: `${ESC}[?25l`,
  show: `${ESC}[?25h`,
  to: (row: number, col: number) => `${ESC}[${row};${col}H`,
  up: (n = 1) => `${ESC}[${n}A`,
  down: (n = 1) => `${ESC}[${n}B`,
  forward: (n = 1) => `${ESC}[${n}C`,
  back: (n = 1) => `${ESC}[${n}D`,
  toColumn: (col: number) => `${ESC}[${col}G`,
  home: `${ESC}[H`,
}

export const clear = {
  line: `${ESC}[2K`,
  lineEnd: `${ESC}[K`,
  lineStart: `${ESC}[1K`,
  screen: `${ESC}[2J`,
  screenEnd: `${ESC}[J`,
  screenStart: `${ESC}[1J`,
}

export const style = {
  reset: `${ESC}[0m`,
  bold: `${ESC}[1m`,
  dim: `${ESC}[2m`,
  italic: `${ESC}[3m`,
  underline: `${ESC}[4m`,
}

export const fg = {
  black: `${ESC}[30m`,
  red: `${ESC}[31m`,
  green: `${ESC}[32m`,
  yellow: `${ESC}[33m`,
  blue: `${ESC}[34m`,
  magenta: `${ESC}[35m`,
  cyan: `${ESC}[36m`,
  white: `${ESC}[37m`,
  gray: `${ESC}[90m`,
  brightRed: `${ESC}[91m`,
  brightGreen: `${ESC}[92m`,
  brightYellow: `${ESC}[93m`,
  brightBlue: `${ESC}[94m`,
  brightMagenta: `${ESC}[95m`,
  brightCyan: `${ESC}[96m`,
  brightWhite: `${ESC}[97m`,
}

export const bg = {
  black: `${ESC}[40m`,
  red: `${ESC}[41m`,
  green: `${ESC}[42m`,
  yellow: `${ESC}[43m`,
  blue: `${ESC}[44m`,
  magenta: `${ESC}[45m`,
  cyan: `${ESC}[46m`,
  white: `${ESC}[47m`,
}

export const rgb = (r: number, g: number, b: number): { fg: string; bg: string } => {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.floor(n)))
  const R = clamp(r)
  const G = clamp(g)
  const B = clamp(b)
  return {
    fg: `${ESC}[38;2;${R};${G};${B}m`,
    bg: `${ESC}[48;2;${R};${G};${B}m`,
  }
}

export const screen = {
  alt: `${ESC}[?1049h`,
  main: `${ESC}[?1049l`,
}

// Helper to write to stdout
export function write(s: string) {
  process.stdout.write(s)
}

// Get terminal dimensions
export function size() {
  return {
    rows: process.stdout.rows || 24,
    cols: process.stdout.columns || 80,
  }
}
