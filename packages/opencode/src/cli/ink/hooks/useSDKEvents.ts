import { useEffect, useCallback, useRef, useState } from "react"
import { createOpencodeClient, type Event } from "@opencode-ai/sdk/v2"
import type { Action } from "@/cli/ink/state/reducer"
import type { Dispatch } from "react"

export function useSDKEvents(sessionId: string | null, dispatch: Dispatch<Action>) {
  const sdkRef = useRef<ReturnType<typeof createOpencodeClient> | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  useEffect(() => {
    if (!sessionId) return

    const abortController = new AbortController()
    const sdk = createOpencodeClient({
      baseUrl: process.env.OPENCODE_API_URL || "http://localhost:4096",
      signal: abortController.signal,
    })

    sdkRef.current = sdk

    const subscribeToEvents = async () => {
      try {
        const events = await sdk.event.subscribe(
          {},
          {
            signal: abortController.signal,
          },
        )

        for await (const event of events.stream) {
          handleEvent(event, dispatch, sessionId, setIsStreaming)
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return
        }
        console.error("Event subscription error:", error)
      }
    }

    subscribeToEvents()

    return () => {
      sdkRef.current = null
      abortController.abort()
    }
  }, [sessionId, dispatch])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || !sdkRef.current) return

      setIsStreaming(true)
      dispatch({ type: "CLEAR_STREAMING" })

      try {
        await sdkRef.current.session.prompt({
          sessionID: sessionId,
          parts: [{ type: "text", text: content }],
        })
      } catch (err) {
        setIsStreaming(false)
        console.error("Failed to send message:", err)
        throw err
      }
    },
    [sessionId, dispatch],
  )

  return {
    sendMessage,
    isStreaming,
  }
}

function handleEvent(
  event: Event,
  dispatch: Dispatch<Action>,
  sessionId: string,
  setIsStreaming: (value: boolean) => void,
) {
  switch (event.type) {
    case "message.part.updated": {
      const part = event.properties.part
      if (part.sessionID !== sessionId) return

      if (part.type === "tool") {
        const toolState = part.state

        switch (toolState.status) {
          case "running": {
            const input: Record<string, unknown> = {}
            for (const [key, value] of Object.entries(toolState.input)) {
              if (typeof value === "object" && value !== null) {
                input[key] = JSON.stringify(value)
              } else {
                input[key] = value
              }
            }
            dispatch({
              type: "TOOL_START",
              payload: {
                id: part.callID,
                name: part.tool,
                input: input as Record<string, string | number | boolean | null | undefined>,
              },
            })
            break
          }

          case "completed":
            dispatch({
              type: "TOOL_END",
              payload: {
                id: part.callID,
                output: toolState.output,
              },
            })
            break

          case "error":
            dispatch({
              type: "TOOL_END",
              payload: {
                id: part.callID,
                error: toolState.error,
              },
            })
            break

          case "pending":
            break
        }
      }

      if (part.type === "subtask") {
        dispatch({
          type: "TASK_START",
          payload: {
            id: part.id,
            description: part.description,
          },
        })
      }
      break
    }

    case "message.updated": {
      if (event.properties.info.sessionID !== sessionId) return
      setIsStreaming(false)
      dispatch({
        type: "MESSAGE_COMPLETE",
        payload: { id: event.properties.info.id },
      })
      break
    }

    case "session.status": {
      if (event.properties.sessionID !== sessionId) return
      if (event.properties.status.type === "idle") {
        setIsStreaming(false)
        dispatch({ type: "CLEAR_STREAMING" })
      }
      break
    }

    default:
      break
  }
}
