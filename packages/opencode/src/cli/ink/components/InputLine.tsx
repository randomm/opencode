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

export const InputLine = ({
  onSubmit,
  prompt,
  placeholder = "",
  initialValue = "",
  disabled = false,
  focus = true,
}: InputLineProps): ReactElement => {
  const [value, setValue] = useState(initialValue)
  const [cursorOffset, setCursorOffset] = useState(initialValue.length)

  useInput(
    (input, key) => {
      if (disabled || !focus) return

      if (key.return) {
        onSubmit(value)
        setValue("")
        setCursorOffset(0)
      } else if (key.backspace || key.delete) {
        if (cursorOffset > 0) {
          setValue((prev) => prev.slice(0, cursorOffset - 1) + prev.slice(cursorOffset))
          setCursorOffset((prev) => prev - 1)
        }
      } else if (key.leftArrow) {
        setCursorOffset((prev) => Math.max(0, prev - 1))
      } else if (key.rightArrow) {
        setCursorOffset((prev) => Math.min(value.length, prev + 1))
      } else if (!key.ctrl && !key.meta && input) {
        setValue((prev) => prev.slice(0, cursorOffset) + input + prev.slice(cursorOffset))
        setCursorOffset((prev) => prev + input.length)
      }
    },
    { isActive: focus && !disabled },
  )

  const displayPrompt = prompt ?? `${theme.prompt.symbol} `
  const displayValue = value || (placeholder && !value ? placeholder : "")
  const displayWithCursor = displayValue.slice(0, cursorOffset) + "█" + displayValue.slice(cursorOffset)

  return (
    <Box>
      <Text color={theme.prompt.agent}>{displayPrompt}</Text>
      {disabled ? <Text dimColor>{displayValue}</Text> : <Text>{displayWithCursor}</Text>}
    </Box>
  )
}
