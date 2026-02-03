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
    }
    initSession().catch(console.error)
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
      } else if (value.trim() && state.session.id) {
        // Clear previous streaming
        dispatch({ type: "CLEAR_STREAMING" })

        // Send message via SessionPrompt
        const parts = [{ type: "text" as const, text: value.trim() }]
        await SessionPrompt.prompt({
          sessionID: state.session.id,
          agent: state.session.agent,
          model: undefined,
          parts,
        })
      }
    },
    [dispatch, setUIMode, state.session.id, state.session.agent],
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
