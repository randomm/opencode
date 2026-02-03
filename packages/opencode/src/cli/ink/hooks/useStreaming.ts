import { useState, useCallback, useRef } from "react"

interface StreamEvent {
  type: string
  text?: string
  [key: string]: unknown
}

export function useStreaming(sessionId: string | null) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId) return

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      setIsStreaming(true)
      setStreamingText("")

      try {
        const baseUrl = process.env.OPENCODE_API_URL || "http://localhost:4096"
        const response = await fetch(`${baseUrl}/session/${sessionId}/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error("No response body")
        }

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              try {
                const event: StreamEvent = JSON.parse(data)

                if (event.type === "delta" && event.text) {
                  setStreamingText((prev) => prev + event.text)
                }

                if (event.type === "done") {
                  setIsStreaming(false)
                  return
                }
              } catch (error) {
                console.error("Failed to parse SSE event:", error)
              }
            }
          }
        }

        setIsStreaming(false)
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return
        }
        setIsStreaming(false)
        throw error
      }
    },
    [sessionId],
  )

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
  }, [])

  return {
    isStreaming,
    streamingText,
    sendMessage,
    cancel,
  }
}
