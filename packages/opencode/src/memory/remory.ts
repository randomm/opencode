// Remory integration using Unix socket client for JSON-RPC communication

import { UnixSocketClient, type JsonRpcRequest, DEFAULT_SOCKET_PATH } from "./socket-client"
import { Log } from "@/util/log"
import { Config } from "../config/config"

const log = Log.create({ service: "memory.rememory" })

interface RemoryEnabled {
  enabled: boolean
  client: UnixSocketClient | null
  socketPath: string
}

// Singleton state
const state: RemoryEnabled = {
  enabled: false,
  client: null,
  socketPath: DEFAULT_SOCKET_PATH,
}

// Track latest search request per user to handle race conditions
// Maps userId -> latest requestId
const pending = new Map<string, string>()

export interface MemoryAddParams {
  text: string
  userId: string
  infer: boolean
}

export interface MemorySearchParams {
  query: string
  userId: string
  limit: number
  recency?: number
}

export interface MemoryListParams {
  userId: string
  limit: number
}

export interface MemorySearchParams {
  query: string
  userId: string
  limit: number
  filters?: Record<string, unknown>
  recency?: number
}

export interface MemoryDeleteParams {
  memoryId: string
  userId: string
}

export interface MemoryResult {
  memory_id: string
  text: string
  metadata?: Record<string, unknown>
  created_at?: string
  score?: number
}

export interface MemorySearchResponse {
  results: MemoryResult[]
}

export interface MemoryListResponse {
  memories: MemoryResult[]
}

export interface Memory {
  text: string
  metadata?: Record<string, unknown>
  created_at?: string
  distance?: number
}

export async function initialize(socketPath?: string): Promise<boolean> {
  state.socketPath = socketPath || DEFAULT_SOCKET_PATH

  const client = new UnixSocketClient(state.socketPath)
  try {
    await client.connect()
    state.client = client
    state.enabled = true
    log.info("remory daemon connected", { socketPath: state.socketPath })
    return true
  } catch (error) {
    state.enabled = false
    state.client = null
    log.warn("remory daemon not available", {
      socketPath: state.socketPath,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export async function add(params: MemoryAddParams): Promise<MemoryResult | null> {
  if (!state.enabled || !state.client) {
    log.debug("remory add skipped - daemon not enabled")
    return null
  }

  try {
    const request: JsonRpcRequest = {
      id: generateId(),
      method: "add",
      params: {
        text: params.text,
        user_id: params.userId,
        infer: params.infer,
      },
    }

    const response = await state.client.send(request)
    log.debug("memory added", { memoryId: response.result })

    return (response.result as MemoryResult) || null
  } catch (error) {
    log.error("failed to add memory", {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function search(params: MemorySearchParams): Promise<MemoryResult[]> {
  if (!state.enabled || !state.client) {
    log.debug("remory search skipped - daemon not enabled")
    return []
  }

  const id = generateId()
  // Track this as the latest request for this user
  pending.set(params.userId, id)

  try {
    const request: JsonRpcRequest = {
      id,
      method: "search",
      params: {
        query: params.query,
        user_id: params.userId,
        limit: params.limit,
        recency: params.recency,
      },
    }

    const response = await state.client.send(request)

    // Check if this request was superseded by a newer one
    if (pending.get(params.userId) !== id) {
      log.debug("search result discarded - superseded by newer request", { id })
      return []
    }

    const result = response.result as MemorySearchResponse

    log.debug("memory search completed", { resultCount: result.results?.length || 0 })
    return result.results || []
  } catch (error) {
    // Only log error if this is still the active request
    if (pending.get(params.userId) === id) {
      log.error("failed to search memory", {
        query: params.query,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return []
  }
}

export async function list(params: MemoryListParams): Promise<MemoryResult[]> {
  if (!state.enabled || !state.client) {
    log.debug("remory list skipped - daemon not enabled")
    return []
  }

  try {
    const request: JsonRpcRequest = {
      id: generateId(),
      method: "list",
      params: {
        user_id: params.userId,
        limit: params.limit,
      },
    }

    const response = await state.client.send(request)
    const result = response.result as MemoryListResponse

    log.debug("memory list completed", { count: result.memories?.length || 0 })
    return result.memories || []
  } catch (error) {
    log.error("failed to list memory", {
      userId: params.userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

export async function remove(params: MemoryDeleteParams): Promise<boolean> {
  if (!state.enabled || !state.client) {
    log.debug("remory delete skipped - daemon not enabled")
    return false
  }

  try {
    const request: JsonRpcRequest = {
      id: generateId(),
      method: "delete",
      params: {
        memory_id: params.memoryId,
        user_id: params.userId,
      },
    }

    await state.client.send(request)
    log.debug("memory deleted", { memoryId: params.memoryId })
    return true
  } catch (error) {
    log.error("failed to delete memory", {
      memoryId: params.memoryId,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export async function close(): Promise<void> {
  pending.clear()
  if (state.client) {
    await state.client.close()
    state.client = null
    state.enabled = false
    log.info("remory client closed")
  }
}

export function invalidate(userId: string): void {
  pending.delete(userId)
  log.debug("pending search invalidated", { userId })
}

export function isEnabled(): boolean {
  return state.enabled
}

function generateId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

let remoryAvailable: boolean | null = null
let lastCheck: number = 0
const CACHE_TTL = 60000 // 1 minute

export async function checkRemoryAvailable(): Promise<boolean> {
  const now = Date.now()
  if (remoryAvailable !== null && now - lastCheck < CACHE_TTL) {
    return remoryAvailable
  }
  lastCheck = now
  try {
    if (!isEnabled()) {
      remoryAvailable = false
    } else {
      await list({ userId: "check", limit: 1 })
      remoryAvailable = true
    }
  } catch {
    remoryAvailable = false
    log.warn("remory unavailable, continuing without memory features")
  }
  return remoryAvailable
}

export function resetAvailabilityCache(): void {
  remoryAvailable = null
  lastCheck = 0
}

export async function safeRemorySearch(query: string, userId: string, limit?: number): Promise<Memory[]> {
  if (!(await checkRemoryAvailable())) return []

  // Skip memory search for empty or whitespace-only descriptions
  if (!query?.trim()) {
    return []
  }

  try {
    const results = await search({
      query,
      userId,
      limit: limit ?? 5,
    })

    const memories = results.map((r) => ({
      text: r.text,
      metadata: r.metadata,
      created_at: r.created_at,
      distance: r.score,
    }))

    // Get threshold from config, default to 0.4
    let threshold = 0.4
    try {
      const config = await Config.get()
      threshold = config.experimental?.remory_distance_threshold ?? 0.4
    } catch {
      // Use default threshold if config loading fails
    }

    const relevant = memories.filter((m) => m.distance && m.distance < threshold)
    return relevant
  } catch {
    return []
  }
}

export async function safeRemoryAdd(text: string, userId: string, metadata?: object): Promise<void> {
  if (!(await checkRemoryAvailable())) return

  try {
    // Serialize metadata into text if provided
    const enhancedText = metadata ? `${text}\n\nMetadata: ${JSON.stringify(metadata)}` : text

    await add({
      text: enhancedText,
      userId,
      infer: false,
    })
  } catch (error) {
    log.warn("memory add failed", {
      error: error instanceof Error ? error.message : String(error),
      userId,
      textLength: text.length,
      hasMetadata: !!metadata,
    })
  }
}

export async function getUserId(): Promise<string> {
  try {
    const { execSync } = await import("child_process")
    return execSync("git rev-list --max-parents=0 HEAD").toString().trim()
  } catch {
    return "default-user"
  }
}

export const Remory = {
  initialize,
  add,
  search,
  list,
  remove,
  close,
  invalidate,
  isEnabled,
  checkRemoryAvailable,
  safeRemorySearch,
  safeRemoryAdd,
  getUserId,
  resetAvailabilityCache,
}
