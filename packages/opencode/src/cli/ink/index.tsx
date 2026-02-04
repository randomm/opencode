/** @jsxImportSource react */
import { render } from "ink"
import App from "./App"

export function startInkTUI() {
  const instance = render(<App />)
  return instance.waitUntilExit()
}
