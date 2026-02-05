/** @jsxImportSource react */

import { render } from "ink"
import App from "./App"

export function startInkTUI() {
  // Configure stdin/stdout for Ink to receive keyboard events
  const instance = render(<App />, {
    stdin: process.stdin,
    stdout: process.stdout,
    exitOnCtrlC: true, // Let Ink handle Ctrl+C exit
  })

  return instance.waitUntilExit()
}
