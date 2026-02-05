import { useEffect, useCallback, useRef, useState } from "react"

import { createOpencodeClient, type Event } from "@opencode-ai/sdk/v2"
import type { Action } from "@/cli/ink/state/reducer"
import type { Dispatch } from "react"
import { Server } from "@/server/server"
import { Flag } from "@/flag/flag"

function getAuthorizationHeader(): string | undefined {
  const password = Flag.OPENCODE_SERVER_PASSWORD
  if (!password) return undefined
  const username = Flag.OPENCODE_SERVER_USERNAME ?? "opencode"
  return `Basic ${btoa(`${username}:${password}`)}`
}

function createInProcessFetch() {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const auth = getAuthorizationHeader()
    if (auth) request.headers.set("Authorization", auth)
    return Server.App().fetch(request)
  }) as typeof globalThis.fetch
}

export function useSDKEvents(sessionId: string | null, dispatch: Dispatch<Action>) {
  const sdkRef = useRef<ReturnType<typeof createOpencodeClient> | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const streamingLockRef = useRef(false)

  useEffect(() => {
    if (!sessionId) {
      return
    }

    const abortController = new AbortController()
    const sdk = createOpencodeClient({
      baseUrl: "http://opencode.internal",
      fetch: createInProcessFetch(),
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
          handleEvent(event, dispatch, sessionId, setIsStreaming, currentAssistantMessageIdRef, streamingLockRef)
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
      if (!sessionId || !sdkRef.current) {
        throw new Error("Session not ready - SDK client not initialized")
      }

      // Use ref-based locking to prevent TOCTOU race
      if (streamingLockRef.current || isStreaming) {
        throw new Error("Message already in progress - please wait")
      }

      // Acquire lock BEFORE any async operations
      streamingLockRef.current = true

      dispatch({ type: "CLEAR_STREAMING" })

      setIsStreaming(true)

      try {
        const result = await sdkRef.current.session.prompt({
          sessionID: sessionId,
          parts: [{ type: "text", text: content }],
        })

        if (result.error) {
          throw new Error("Failed to send message")
        }

        currentAssistantMessageIdRef.current = result.data.info.id
      } catch (err) {
        currentAssistantMessageIdRef.current = null
        setIsStreaming(false)
        streamingLockRef.current = false
        console.error("Failed to send message:", err)
        throw err
      }
    },
    [sessionId, dispatch, isStreaming],
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
  currentAssistantMessageIdRef: { current: string | null },
  streamingLockRef: { current: boolean },
) {
  switch (event.type) {
    case "message.part.updated": {
      const part = event.properties.part
      if (part.sessionID !== sessionId) return

      // Handle text streaming - only for assistant messages
      if (part.type === "text") {
        // Skip if this is not the expected assistant message
        if (currentAssistantMessageIdRef.current && part.messageID !== currentAssistantMessageIdRef.current) {
          return
        }

        // Use delta for incremental updates, fallback to full text
        const content = event.properties.delta ?? part.text
        if (typeof content === "string" && content.length > 0) {
          dispatch({
            type: "STREAM_TEXT",
            payload: content,
          })
        }
      }

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

      // Clear the tracked message ID if this is the expected assistant message
      if (currentAssistantMessageIdRef.current === event.properties.info.id) {
        currentAssistantMessageIdRef.current = null
        streamingLockRef.current = false
      }

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
        streamingLockRef.current = false

        // Fallback: If MESSAGE_COMPLETE never arrived (SDK crash, network error),
        // clear streaming state to prevent memory leak
        if (currentAssistantMessageIdRef.current !== null) {
          currentAssistantMessageIdRef.current = null
          dispatch({ type: "CLEAR_STREAMING" })
        }
        // Otherwise, MESSAGE_COMPLETE already moved content to messages array
      }
      break
    }

    default:
      break
  }
}
