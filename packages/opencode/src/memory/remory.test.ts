import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import {
  initialize,
  add,
  search,
  list,
  remove,
  close,
  invalidate,
  isEnabled,
  type MemoryAddParams,
  type MemorySearchParams,
  type MemoryListParams,
  type MemoryDeleteParams,
} from "./remory"
import { mkdtempSync, rmSync, existsSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

describe("Remory Integration", () => {
  let testSocketPath: string
  let testDir: string
  let server: { stop: () => void } | null
  let addCallCount = 0
  let searchCallCount = 0
  let listCallCount = 0
  let deleteCallCount = 0

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "remory-integration-test-"))
    testSocketPath = join(testDir, "remory.sock")
    server = null
    addCallCount = 0
    searchCallCount = 0
    listCallCount = 0
    deleteCallCount = 0
  })

  afterEach(async () => {
    if (server) {
      server.stop()
    }
    await close()
    if (existsSync(testSocketPath)) {
      rmSync(testSocketPath)
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  type RequestHandler = (request: { id: string; method: string; params: Record<string, unknown> }) => unknown

  function createSocketServer(handler: RequestHandler) {
    const decoder = new TextDecoder()
    return Bun.listen({
      unix: testSocketPath,
      socket: {
        data(socket, chunk) {
          const data = decoder.decode(chunk)
          const request = JSON.parse(data.trim()) as { id: string; method: string; params: Record<string, unknown> }
          const result = handler(request) as { result?: unknown; error?: unknown }
          const response = JSON.stringify({ id: request.id, result: result.result, error: result.error }) + "\n"
          socket.write(response)
          socket.end()
        },
        open() {},
        close() {},
        error() {},
      },
    })
  }

  function setupMockServer() {
    server = createSocketServer((request) => {
      if (request.method === "add") {
        addCallCount++
        const params = request.params as { text: string; user_id: string; infer: boolean }
        return {
          result: {
            memory_id: `mem-${addCallCount}`,
            text: params.text,
            user_id: params.user_id,
            metadata: { infer: params.infer },
          },
        }
      }

      if (request.method === "search") {
        searchCallCount++
        const params = request.params as { query: string; user_id: string; limit: number }
        return {
          result: {
            results: [
              {
                memory_id: "mem-1",
                text: `Match for: ${params.query}`,
                user_id: params.user_id,
                score: 0.95,
              },
            ],
          },
        }
      }

      if (request.method === "list") {
        listCallCount++
        const params = request.params as { user_id: string; limit: number }
        return {
          result: {
            memories: [
              { memory_id: "mem-1", text: "Memory 1", user_id: params.user_id },
              { memory_id: "mem-2", text: "Memory 2", user_id: params.user_id },
            ].slice(0, params.limit),
          },
        }
      }

      if (request.method === "delete") {
        deleteCallCount++
        return { result: { deleted: true } }
      }

      return { error: { code: -32601, message: "Method not found" } }
    })
  }

  it("should initialize successfully with mock daemon", async () => {
    setupMockServer()

    const initialized = await initialize(testSocketPath)
    expect(initialized).toBe(true)
    expect(isEnabled()).toBe(true)
  })

  it("should fail initialization when daemon not available", async () => {
    const nonExistentPath = join(testDir, "nonexistent.sock")

    const initialized = await initialize(nonExistentPath)
    expect(initialized).toBe(false)
    expect(isEnabled()).toBe(false)
  })

  it("should add memory successfully", async () => {
    setupMockServer()
    await initialize(testSocketPath)

    const params: MemoryAddParams = {
      text: "Alice works at Google",
      userId: "alice",
      infer: true,
    }

    const result = await add(params)

    expect(result).not.toBeNull()
    expect(result?.memory_id).toBe("mem-1")
    expect(result?.text).toBe("Alice works at Google")
    expect(addCallCount).toBe(1)
  })

  it("should return null on add when not enabled", async () => {
    const nonExistentPath = join(testDir, "nonexistent.sock")
    await initialize(nonExistentPath)

    const result = await add({
      text: "Test memory",
      userId: "test",
      infer: false,
    })

    expect(result).toBeNull()
    expect(addCallCount).toBe(0)
  })

  it("should search memory successfully", async () => {
    setupMockServer()
    await initialize(testSocketPath)

    const params: MemorySearchParams = {
      query: "where does alice work?",
      userId: "alice",
      limit: 5,
      recency: 30,
    }

    const results = await search(params)

    expect(results).toHaveLength(1)
    expect(results[0].memory_id).toBe("mem-1")
    expect(results[0].text).toContain("where does alice work?")
    expect(results[0].score).toBe(0.95)
    expect(searchCallCount).toBe(1)
  })

  it("should return empty array on search when not enabled", async () => {
    const nonExistentPath = join(testDir, "nonexistent.sock")
    await initialize(nonExistentPath)

    const results = await search({
      query: "test",
      userId: "test",
      limit: 5,
    })

    expect(results).toEqual([])
    expect(searchCallCount).toBe(0)
  })

  it("should list memories successfully", async () => {
    setupMockServer()
    await initialize(testSocketPath)

    const params: MemoryListParams = {
      userId: "alice",
      limit: 10,
    }

    const memories = await list(params)

    expect(memories).toHaveLength(2)
    expect(memories[0].memory_id).toBe("mem-1")
    expect(memories[1].memory_id).toBe("mem-2")
    expect(listCallCount).toBe(1)
  })

  it("should limit memory list to requested limit", async () => {
    setupMockServer()
    await initialize(testSocketPath)

    const memories = await list({
      userId: "alice",
      limit: 1,
    })

    expect(memories).toHaveLength(1)
  })

  it("should return empty array on list when not enabled", async () => {
    const nonExistentPath = join(testDir, "nonexistent.sock")
    await initialize(nonExistentPath)

    const memories = await list({
      userId: "test",
      limit: 10,
    })

    expect(memories).toEqual([])
    expect(listCallCount).toBe(0)
  })

  it("should delete memory successfully", async () => {
    setupMockServer()
    await initialize(testSocketPath)

    const params: MemoryDeleteParams = {
      memoryId: "mem-1",
      userId: "alice",
    }

    const deleted = await remove(params)

    expect(deleted).toBe(true)
    expect(deleteCallCount).toBe(1)
  })

  it("should return false on delete when not enabled", async () => {
    const nonExistentPath = join(testDir, "nonexistent.sock")
    await initialize(nonExistentPath)

    const deleted = await remove({
      memoryId: "mem-1",
      userId: "test",
    })

    expect(deleted).toBe(false)
    expect(deleteCallCount).toBe(0)
  })

  it("should properly close connection", async () => {
    setupMockServer()
    await initialize(testSocketPath)

    expect(isEnabled()).toBe(true)

    await close()

    expect(isEnabled()).toBe(false)
  })

  it("should handle daemon errors gracefully on add", async () => {
    server = createSocketServer(() => ({ error: { code: -32002, message: "Embedding generation failed" } }))

    await initialize(testSocketPath)

    const result = await add({
      text: "Test",
      userId: "test",
      infer: false,
    })

    expect(result).toBeNull()
  })

  it("should handle daemon errors gracefully on search", async () => {
    server = createSocketServer(() => ({ error: { code: -32001, message: "Database query failed" } }))

    await initialize(testSocketPath)

    const results = await search({
      query: "test",
      userId: "test",
      limit: 5,
    })

    expect(results).toEqual([])
  })

  it("should handle daemon errors gracefully on list", async () => {
    server = createSocketServer(() => ({ error: { code: -32001, message: "Database error" } }))

    await initialize(testSocketPath)

    const memories = await list({
      userId: "test",
      limit: 10,
    })

    expect(memories).toEqual([])
  })

  it("should handle daemon errors gracefully on delete", async () => {
    server = createSocketServer(() => ({ error: { code: -32001, message: "Database error on delete" } }))

    await initialize(testSocketPath)

    const deleted = await remove({
      memoryId: "mem-1",
      userId: "test",
    })

    expect(deleted).toBe(false)
  })

  it("should discard stale search results when superseded by newer request", async () => {
    let calls = 0

    // Create a socket server with delayed responses
    const decoder = new TextDecoder()
    server = Bun.listen({
      unix: testSocketPath,
      socket: {
        async data(socket, chunk) {
          const data = decoder.decode(chunk)
          const request = JSON.parse(data.trim()) as { id: string; method: string; params: { query: string } }

          if (request.method === "search") {
            calls++
            const call = calls
            const delay = call === 1 ? 100 : 10 // First call is slow, second is fast

            await new Promise((r) => setTimeout(r, delay))

            const response =
              JSON.stringify({
                id: request.id,
                result: {
                  results: [
                    {
                      memory_id: `mem-${call}`,
                      text: `Result from call ${call}: ${request.params.query}`,
                      score: 0.9,
                    },
                  ],
                },
              }) + "\n"
            socket.write(response)
            socket.end()
          }
        },
        open() {},
        close() {},
        error() {},
      },
    })

    await initialize(testSocketPath)

    // Launch two concurrent searches - first one is slow, second is fast
    const [result1, result2] = await Promise.all([
      search({ query: "slow query", userId: "alice", limit: 5 }),
      search({ query: "fast query", userId: "alice", limit: 5 }),
    ])

    // First search should return empty (superseded)
    expect(result1).toEqual([])
    // Second search should return results (it's the latest)
    expect(result2).toHaveLength(1)
    expect(result2[0].text).toContain("Result from call 2")
    expect(calls).toBe(2)
  })

  it("should handle concurrent searches for different users independently", async () => {
    let calls = 0

    const decoder = new TextDecoder()
    server = Bun.listen({
      unix: testSocketPath,
      socket: {
        async data(socket, chunk) {
          const data = decoder.decode(chunk)
          const request = JSON.parse(data.trim()) as {
            id: string
            method: string
            params: { query: string; user_id: string }
          }

          if (request.method === "search") {
            calls++
            const call = calls
            // Add small delay to ensure ordering
            await new Promise((r) => setTimeout(r, 10))

            const response =
              JSON.stringify({
                id: request.id,
                result: {
                  results: [
                    {
                      memory_id: `mem-${call}`,
                      text: `Result for ${request.params.user_id}`,
                      user_id: request.params.user_id,
                      score: 0.9,
                    },
                  ],
                },
              }) + "\n"
            socket.write(response)
            socket.end()
          }
        },
        open() {},
        close() {},
        error() {},
      },
    })

    await initialize(testSocketPath)

    // Different users should not interfere with each other
    const [alice, bob] = await Promise.all([
      search({ query: "alice query", userId: "alice", limit: 5 }),
      search({ query: "bob query", userId: "bob", limit: 5 }),
    ])

    // Both should get results
    expect(alice).toHaveLength(1)
    expect(alice[0].text).toContain("alice")
    expect(bob).toHaveLength(1)
    expect(bob[0].text).toContain("bob")
    expect(calls).toBe(2)
  })

  it("should invalidate pending searches", async () => {
    let responded = false

    const decoder = new TextDecoder()
    server = Bun.listen({
      unix: testSocketPath,
      socket: {
        async data(socket, chunk) {
          const data = decoder.decode(chunk)
          const request = JSON.parse(data.trim()) as { id: string; method: string }

          if (request.method === "search") {
            // Simulate slow response
            await new Promise((r) => setTimeout(r, 50))
            responded = true

            const response =
              JSON.stringify({
                id: request.id,
                result: {
                  results: [{ memory_id: "mem-1", text: "Result", score: 0.9 }],
                },
              }) + "\n"
            socket.write(response)
            socket.end()
          }
        },
        open() {},
        close() {},
        error() {},
      },
    })

    await initialize(testSocketPath)

    // Start search then immediately invalidate
    const promise = search({ query: "test", userId: "alice", limit: 5 })
    invalidate("alice")

    const results = await promise

    // Should return empty because it was invalidated
    expect(results).toEqual([])
    expect(responded).toBe(true) // Server still responded
  })
})
