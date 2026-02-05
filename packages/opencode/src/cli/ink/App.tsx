/** @jsxImportSource react */
import { useReducer, useCallback, useState, useRef, useEffect } from "react"
import type { ReactElement } from "react"
import { Box, Text } from "ink"
import { appReducer, initialState } from "./state/reducer"
import { theme } from "./theme"
import { InputLine } from "./components/InputLine"
import { isCommand, executeCommand } from "./commands"
import { Session } from "../../session"
import { Instance } from "../../project/instance"
import { Agent } from "../../agent/agent"
import { useSDKEvents } from "./hooks/useSDKEvents"

export const App = (): ReactElement => {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const [uiMode, setUIMode] = useState(state.ui.mode)
  const sessionRef = useRef(state.session)

  useEffect(() => {
    sessionRef.current = state.session
  }, [state.session])

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const session = await Session.createNext({ directory: Instance.directory })
        const agent = await Agent.defaultAgent()
        dispatch({
          type: "SET_SESSION",
          payload: {
            id: session.id,
            agent,
            model: null,
          },
        })
      } catch (error) {
        console.error("Session init failed:", error)
        dispatch({ type: "CLEAR_STREAMING" })
        dispatch({
          type: "STREAM_TEXT",
          payload: `Error: Failed to initialize session - ${error}\n`,
        })
      }
    }
    initSession()
  }, [])

  // Use SDK events hook for streaming
  const { sendMessage } = useSDKEvents(state.session.id, dispatch)

  const handleSubmit = useCallback(
    async (value: string) => {
      if (isCommand(value)) {
        executeCommand(value, {
          dispatch,
          session: sessionRef.current,
          setUIMode,
        }).catch(() => {
          // Silently handle command errors
        })
      } else if (value.trim()) {
        if (!state.session.id) {
          dispatch({
            type: "STREAM_TEXT",
            payload: "Waiting for session to initialize...\n",
          })
          return
        }
        // Send message via SDK hook
        try {
          await sendMessage(value.trim())
        } catch (err) {
          dispatch({ type: "CLEAR_STREAMING" })
          dispatch({
            type: "STREAM_TEXT",
            payload: `Failed to send message: ${err}\n`,
          })
        }
      }
    },
    [dispatch, setUIMode, state.session.id, sendMessage],
  )

  return (
    <Box flexDirection="column">
      {/* Welcome message - always visible */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          oclite v1.0
        </Text>
        <Text dimColor> - Lightweight OpenCode TUI</Text>
      </Box>

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
