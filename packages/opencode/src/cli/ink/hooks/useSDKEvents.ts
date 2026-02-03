import { useEffect } from "react"
import { createOpencodeClient, type Event } from "@opencode-ai/sdk/v2"
import type { Action } from "@/cli/ink/state/reducer"
import type { Dispatch } from "react"

export function useSDKEvents(sessionId: string | null, dispatch: Dispatch<Action>) {
  useEffect(() => {
    if (!sessionId) return

    const abortController = new AbortController()
    const sdk = createOpencodeClient({
      baseUrl: process.env.OPENCODE_API_URL || "http://localhost:4096",
      signal: abortController.signal,
    })

    const subscribeToEvents = async () => {
      try {
        const events = await sdk.event.subscribe(
          {},
          {
            signal: abortController.signal,
          },
        )

        for await (const event of events.stream) {
          handleEvent(event, dispatch)
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
      abortController.abort()
    }
  }, [sessionId, dispatch])
}

function handleEvent(event: Event, dispatch: Dispatch<Action>) {
  switch (event.type) {
    case "message.part.updated": {
      const part = event.properties.part

      if (part.type === "tool") {
        const toolState = part.state

        switch (toolState.status) {
          case "running":
            dispatch({
              type: "TOOL_START",
              payload: {
                id: part.callID,
                name: part.tool,
                input: toolState.input as Record<string, string | number | boolean | null>,
              },
            })
            break

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
      dispatch({
        type: "MESSAGE_COMPLETE",
        payload: { id: event.properties.info.id },
      })
      break
    }

    case "session.status": {
      if (event.properties.status.type === "idle") {
        dispatch({ type: "CLEAR_STREAMING" })
      }
      break
    }

    default:
      break
  }
}
