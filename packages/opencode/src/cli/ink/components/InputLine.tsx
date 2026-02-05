/** @jsxImportSource react */
import { useState, useCallback, useEffect } from "react"
import type { ReactElement } from "react"
import { Box, Text, useInput } from "ink"

import { theme } from "../theme"

interface InputLineProps {
  onSubmit: (value: string) => void
  prompt?: string
  placeholder?: string
  initialValue?: string
  disabled?: boolean
  focus?: boolean
}

// Sanitize input to remove control characters and ANSI codes
const sanitize = (str: string): string => str.replace(/[\x00-\x1F\x7F\u200B-\u200D\uFEFF]/g, "")

export const InputLine = ({
  onSubmit,
  prompt,
  placeholder = "",
  initialValue = "",
  disabled = false,
  focus = true,
}: InputLineProps): ReactElement => {
  // Use single state object to prevent race conditions
  const [state, setState] = useState({ value: initialValue, cursor: initialValue.length })

  useInput(
    (input, key) => {
      if (disabled || !focus) {
        return
      }

      if (key.return) {
        onSubmit(state.value)
        setState({ value: "", cursor: 0 })
      } else if (key.backspace || key.delete) {
        if (state.cursor > 0) {
          setState((prev) => ({
            value: prev.value.slice(0, prev.cursor - 1) + prev.value.slice(prev.cursor),
            cursor: prev.cursor - 1,
          }))
        }
      } else if (key.leftArrow) {
        setState((prev) => ({ ...prev, cursor: Math.max(0, prev.cursor - 1) }))
      } else if (key.rightArrow) {
        setState((prev) => ({ ...prev, cursor: Math.min(prev.value.length, prev.cursor + 1) }))
      } else if (!key.ctrl && !key.meta && input) {
        // Sanitize input to prevent control characters
        const cleanInput = sanitize(input)
        if (!cleanInput) return

        setState((prev) => ({
          value: prev.value.slice(0, prev.cursor) + cleanInput + prev.value.slice(prev.cursor),
          cursor: prev.cursor + cleanInput.length,
        }))
      }
    },
    { isActive: focus && !disabled },
  )

  const displayPrompt = prompt ?? `${theme.prompt.symbol} `
  const displayValue = state.value || (placeholder && !state.value ? placeholder : "")
  const displayWithCursor = displayValue.slice(0, state.cursor) + "█" + displayValue.slice(state.cursor)

  return (
    <Box>
      <Text color={theme.prompt.agent}>{displayPrompt}</Text>
      {disabled ? <Text dimColor>{displayValue}</Text> : <Text>{displayWithCursor}</Text>}
    </Box>
  )
}
