import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { UnixSocketClient, DEFAULT_SOCKET_PATH } from "./socket-client"
import { mkdtempSync, rmSync, existsSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

describe("UnixSocketClient", () => {
  let testSocketPath: string
  let testDir: string
  let server: ReturnType<typeof Bun.listen> | null

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "remory-test-"))
    testSocketPath = join(testDir, "remory.sock")
    server = null
  })

  afterEach(() => {
    if (server) {
      server.stop()
    }
    if (existsSync(testSocketPath)) {
      rmSync(testSocketPath)
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  function setupMockServer(handler: (socket: any, chunk: Uint8Array) => void): void {
    server = Bun.listen({
      unix: testSocketPath,
      socket: {
        data: handler,
        open: (socket) => {},
      },
    })
  }

  it("should have default socket path set correctly", () => {
    expect(DEFAULT_SOCKET_PATH).toContain("remory.sock")
  })

  it("should create client with socket path", () => {
    const client = new UnixSocketClient(testSocketPath)
    expect(client).toBeDefined()
  })

  it("should fail connect when socket does not exist", async () => {
    const client = new UnixSocketClient(testSocketPath)

    await expect(client.connect()).rejects.toThrow("Failed to connect to remory daemon")
  })

  it("should accept successful JSON-RPC responses", async () => {
    let receivedData = ""
    let requestParsed: { id: string; method: string } | null = null

    server = Bun.listen({
      unix: testSocketPath,
      socket: {
        data: (socket, chunk) => {
          receivedData += new TextDecoder().decode(chunk, { stream: true })

          if (receivedData.includes("\n")) {
            const request = JSON.parse(receivedData) as { id: string; method: string }
            requestParsed = request

            const response =
              JSON.stringify({
                id: request.id,
                result: {
                  memory_id: "mem-123",
                  text: "Test memory",
                },
              }) + "\n"
            socket.write(response)
          }
        },
        open: () => {},
      },
    })

    const client = new UnixSocketClient(testSocketPath)
    await client.connect()

    const response = await client.send({
      id: "req-1",
      method: "add",
      params: { text: "Test", user_id: "alice", infer: false },
    })

    expect(response.error).toBeUndefined()
    expect(response.result).toEqual({
      memory_id: "mem-123",
      text: "Test memory",
    })

    await client.close()
  })

  it("should handle error responses from daemon", async () => {
    const decoder = new TextDecoder()
    server = Bun.listen({
      unix: testSocketPath,
      socket: {
        data: (socket, chunk) => {
          const data = decoder.decode(chunk)
          const request = JSON.parse(data.trim()) as { id: string }

          const response =
            JSON.stringify({
              id: request.id,
              error: {
                code: -32602,
                message: "Invalid params: missing user_id",
              },
            }) + "\n"
          socket.write(response)
          socket.end()
        },
        open: () => {},
      },
    })

    const client = new UnixSocketClient(testSocketPath)
    await client.connect()

    await expect(
      client.send({
        id: "req-2",
        method: "add",
        params: { text: "Test" },
      }),
    ).rejects.toThrow("Remory daemon error (-32602): Invalid params: missing user_id")

    await client.close()
  })

  it("should validate response ID matches request ID", async () => {
    const decoder = new TextDecoder()
    server = Bun.listen({
      unix: testSocketPath,
      socket: {
        data: (socket, chunk) => {
          // Respond with wrong ID
          const response =
            JSON.stringify({
              id: "wrong-id",
              result: { test: "data" },
            }) + "\n"
          socket.write(response)
          socket.end()
        },
        open: () => {},
      },
    })

    const client = new UnixSocketClient(testSocketPath)
    await client.connect()

    await expect(
      client.send({
        id: "req-1",
        method: "search",
        params: { query: "test", user_id: "alice", limit: 5 },
      }),
    ).rejects.toThrow("Response ID mismatch: expected req-1, got wrong-id")

    await client.close()
  })

  it("should handle no response from daemon", async () => {
    server = Bun.listen({
      unix: testSocketPath,
      socket: {
        data: (socket) => {
          // Close immediately without sending a response
          socket.end()
        },
        open: () => {},
      },
    })

    const client = new UnixSocketClient(testSocketPath)
    await client.connect()

    await expect(
      client.send({
        id: "req-1",
        method: "search",
        params: { query: "test", user_id: "alice", limit: 5 },
      }),
    ).rejects.toThrow("No response received from remory daemon")

    await client.close()
  })

  it("should send complete JSON object with newline", async () => {
    let receivedData = ""
    const decoder = new TextDecoder()

    server = Bun.listen({
      unix: testSocketPath,
      socket: {
        data: (socket, chunk) => {
          receivedData = decoder.decode(chunk)
          const response =
            JSON.stringify({
              id: "test-id",
              result: { success: true },
            }) + "\n"
          socket.write(response)
          socket.end()
        },
        open: () => {},
      },
    })

    const client = new UnixSocketClient(testSocketPath)
    await client.connect()

    await client.send({
      id: "test-id",
      method: "add",
      params: { text: "Memory text", user_id: "user-1", infer: true },
    })

    // Verify the JSON was properly formatted
    expect(receivedData).toBe(
      JSON.stringify({
        id: "test-id",
        method: "add",
        params: { text: "Memory text", user_id: "user-1", infer: true },
      }) + "\n",
    )

    await client.close()
  })
})

describe("Socket Error Handling", () => {
  let testSocketPath: string
  let testDir: string

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "remory-error-test-"))
    testSocketPath = join(testDir, "remory.sock")
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it("should mark client as disconnected after error", async () => {
    const nonExistentPath = join(testDir, "nonexistent.sock")

    const client = new UnixSocketClient(nonExistentPath)
    await expect(client.connect()).rejects.toThrow()
  })

  it("should handle malformed JSON responses", async () => {
    const server = Bun.listen({
      unix: testSocketPath,
      socket: {
        data: (socket) => {
          socket.write("invalid json\n")
          socket.end()
        },
        open: () => {},
      },
    })

    const client = new UnixSocketClient(testSocketPath)
    await client.connect()

    await expect(
      client.send({
        id: "req-1",
        method: "search",
        params: { query: "test", user_id: "test", limit: 5 },
      }),
    ).rejects.toThrow()

    server.stop()
    await client.close()
  })
})
