// Unix socket client for JSON-RPC communication with remory daemon

import { Log } from "@/util/log"

const log = Log.create({ service: "memory.socket-client" })

export interface JsonRpcRequest {
  id: string
  method: string
  params: Record<string, unknown>
}

export interface JsonRpcResponse {
  id: string
  result?: unknown
  error?: { code: number; message: string }
}

export class UnixSocketClient {
  private socketPath: string
  private connected = false

  constructor(socketPath: string) {
    this.socketPath = socketPath
  }

  async connect(): Promise<void> {
    if (this.connected) return

    try {
      const testSocket = await Bun.connect({
        unix: this.socketPath,
        socket: {
          data: () => {},
          open: (socket) => {
            socket.end()
          },
        },
      })
      // Wait briefly for socket to close
      await new Promise((r) => setTimeout(r, 10))
      this.connected = true
      log.debug("connected to remory daemon", { socketPath: this.socketPath })
    } catch (error) {
      this.connected = false
      throw new Error(
        `Failed to connect to remory daemon at ${this.socketPath}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.connected) {
      await this.connect()
    }

    const decoder = new TextDecoder()

    return new Promise((resolve, reject) => {
      let buffer = ""
      let resolved = false

      const tryParse = (data: string): JsonRpcResponse | null => {
        const trimmed = data.trim()
        if (!trimmed) return null

        try {
          const response = JSON.parse(trimmed) as JsonRpcResponse

          if (response.error) {
            throw new Error(`Remory daemon error (${response.error.code}): ${response.error.message}`)
          }

          if (response.id !== request.id) {
            throw new Error(`Response ID mismatch: expected ${request.id}, got ${response.id}`)
          }

          return response
        } catch (e) {
          // Re-throw validation errors, ignore parse errors
          if (e instanceof Error && (e.message.includes("Remory daemon") || e.message.includes("Response ID"))) {
            throw e
          }
          return null
        }
      }

      const finish = (sock: { end: () => void }) => {
        if (resolved) return
        resolved = true
        sock.end()
      }

      Bun.connect({
        unix: this.socketPath,
        socket: {
          data: (sock, chunk) => {
            if (resolved) return
            buffer += decoder.decode(chunk, { stream: true })

            // Try parsing complete messages ending with newline
            if (buffer.includes("\n") || buffer.trimEnd().endsWith("}")) {
              try {
                const response = tryParse(buffer)
                if (response) {
                  finish(sock)
                  resolve(response)
                }
              } catch (e) {
                finish(sock)
                reject(e)
              }
            }
          },
          open: (sock) => {
            const json = JSON.stringify(request) + "\n"
            sock.write(json)
          },
          close: () => {
            if (resolved) return
            if (buffer) {
              try {
                const response = tryParse(buffer)
                if (response) {
                  resolved = true
                  resolve(response)
                  return
                }
              } catch (e) {
                resolved = true
                reject(e)
                return
              }
            }
            resolved = true
            reject(new Error("No response received from remory daemon"))
          },
          error: (_, err) => {
            if (resolved) return
            resolved = true
            this.connected = false
            log.error("socket communication error", {
              error: err instanceof Error ? err.message : String(err),
            })
            reject(err)
          },
        },
      }).catch((err) => {
        if (resolved) return
        resolved = true
        this.connected = false
        log.error("socket communication error", {
          error: err instanceof Error ? err.message : String(err),
        })
        reject(err)
      })
    })
  }

  async close(): Promise<void> {
    this.connected = false
    log.debug("client closed")
  }
}

export const DEFAULT_SOCKET_PATH = process.env.REMORY_SOCKET_PATH || `${process.env.HOME || "~"}/.remory/remory.sock`
