/** @jsxImportSource react */
import { render, Text } from "ink"
import React from "react"

const App = () => (
  <>
    <Text color="green">Ink is running with React 19!</Text>
    {"\n"}
    <Text dimColor>Run with: bun --no-plugins src/cli/ink/test.tsx</Text>
  </>
)

if (import.meta.main) {
  const instance = render(<App />, { maxFps: 30 })
  setTimeout(() => instance.unmount(), 2000)
}
