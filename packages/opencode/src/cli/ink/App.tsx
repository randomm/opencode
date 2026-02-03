/** @jsxImportSource react */
import { useReducer, useCallback, useState, useRef, useEffect } from "react"
import type { ReactElement } from "react"
import { Box, Text } from "ink"
import { appReducer, initialState } from "./state/reducer"
import { theme } from "./theme"
import { InputLine } from "./components/InputLine"
import { isCommand, executeCommand } from "./commands"

export const App = (): ReactElement => {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const [uiMode, setUIMode] = useState(state.ui.mode)
  const sessionRef = useRef(state.session)

  useEffect(() => {
    sessionRef.current = state.session
  }, [state.session])

  const handleSubmit = useCallback(
    (value: string) => {
      if (isCommand(value)) {
        executeCommand(value, {
          dispatch,
          session: sessionRef.current,
          setUIMode,
        }).catch(() => {
          // Silently handle command errors
        })
      }
    },
    [dispatch, setUIMode],
  )

  return (
    <Box flexDirection="column">
      {/* Streaming content */}
      {state.streaming.text && (
        <Box>
          <Text>{state.streaming.text}</Text>
        </Box>
      )}

      {/* Input prompt */}
      <InputLine onSubmit={handleSubmit} prompt={`${state.session.agent} ${theme.prompt.symbol}`} />
    </Box>
  )
}

export default App
