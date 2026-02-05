/** @jsxImportSource react */
import { render } from "ink"
import LiteApp from "./LiteApp"

export function startInkTUI() {
  const instance = render(<LiteApp />)
  return instance.waitUntilExit()
}
