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

      const currentController = abortControllerRef.current
      if (currentController) {
        currentController.abort()
        abortControllerRef.current = null
      }

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      setIsStreaming(true)
      setStreamingText("")

      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null

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

        reader = response.body?.getReader() ?? null
        if (!reader) {
          throw new Error("No response body")
        }

        const decoder = new TextDecoder()
        let buffer = ""
        let streamComplete = false

        try {
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
                    streamComplete = true
                    break
                  }
                } catch (error) {
                  console.error("Failed to parse SSE event:", error)
                }
              }
            }

            if (streamComplete) break
          }
        } finally {
          if (reader) {
            try {
              reader.releaseLock()
              reader = null
            } catch {
              // Ignore lock release errors
            }
          }
        }

        setIsStreaming(false)
      } catch (error) {
        if (reader) {
          try {
            reader.releaseLock()
            reader = null
          } catch {
            // Ignore lock release errors
          }
        }
        if (error instanceof Error && error.name === "AbortError") {
          setIsStreaming(false)
          return
        }
        setIsStreaming(false)
        throw error
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null
        }
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
