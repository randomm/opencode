/** @jsxImportSource react */
import { useState, useCallback } from "react"
import type { ReactElement } from "react"
import { Box, Text } from "ink"
import { InputLine } from "./components/InputLine"
import { theme } from "./theme"

export const LiteApp = (): ReactElement => {
  const [history, setHistory] = useState<string[]>([])

  const handleSubmit = useCallback((value: string) => {
    if (value.trim()) {
      setHistory((prev) => [...prev, `You: ${value}`])
      // For now, just echo back
      setHistory((prev) => [...prev, `Assistant: I received "${value}"`])
    }
  }, [])

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          oclite v1.0
        </Text>
        <Text dimColor> - Lightweight OpenCode TUI</Text>
      </Box>

      {/* History */}
      {history.map((msg, idx) => (
        <Box key={idx}>
          <Text>{msg}</Text>
        </Box>
      ))}

      {/* Input prompt */}
      <InputLine onSubmit={handleSubmit} prompt={`${theme.prompt.symbol} `} placeholder="Type a message..." />
    </Box>
  )
}

export default LiteApp
