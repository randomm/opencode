import { Instance } from "../project/instance"
import { Log } from "../util/log"
import { Flag } from "../flag/flag"

export namespace FileTime {
  const log = Log.create({ service: "file.time" })
  // Per-session read times plus per-file write locks.
  // All tools that overwrite existing files should run their
  // assert/read/write/update sequence inside withLock(filepath, ...)
  // so concurrent writes to the same file are serialized.
  export const state = Instance.state(() => {
    const read: {
      [sessionID: string]: {
        [path: string]: Date | undefined
      }
    } = {}
    const hashlineRead: {
      [sessionID: string]: {
        [path: string]: Date | undefined
      }
    } = {}
    const locks = new Map<string, Promise<void>>()
    return {
      read,
      hashlineRead,
      locks,
    }
  })

  export function read(sessionID: string, file: string) {
    log.info("read", { sessionID, file })
    const { read } = state()
    read[sessionID] = read[sessionID] || {}
    read[sessionID][file] = new Date()
  }

  export function hashlineRead(sessionID: string, file: string) {
    log.info("hashlineRead", { sessionID, file })
    const { hashlineRead: map } = state()
    map[sessionID] = map[sessionID] || {}
    map[sessionID][file] = new Date()
  }

  export function get(sessionID: string, file: string) {
    return state().read[sessionID]?.[file]
  }

  export async function withLock<T>(filepath: string, fn: () => Promise<T>): Promise<T> {
    const current = state()
    const currentLock = current.locks.get(filepath) ?? Promise.resolve()
    let release: () => void = () => {}
    const nextLock = new Promise<void>((resolve) => {
      release = resolve
    })
    const chained = currentLock.then(() => nextLock)
    current.locks.set(filepath, chained)
    await currentLock
    try {
      return await fn()
    } finally {
      release()
      if (current.locks.get(filepath) === chained) {
        current.locks.delete(filepath)
      }
    }
  }

  export async function assert(sessionID: string, filepath: string) {
    if (Flag.OPENCODE_DISABLE_FILETIME_CHECK === true) {
      return
    }

    const time = get(sessionID, filepath)
    if (!time) throw new Error(`You must read file ${filepath} before overwriting it. Use the Read tool first`)
    const stats = await Bun.file(filepath).stat()
    if (stats.mtime.getTime() > time.getTime()) {
      throw new Error(
        `File ${filepath} has been modified since it was last read.\nLast modification: ${stats.mtime.toISOString()}\nLast read: ${time.toISOString()}\n\nPlease read the file again before modifying it.`,
      )
    }
  }

  export async function assertHashlineRead(sessionID: string, filepath: string) {
    if (Flag.OPENCODE_DISABLE_FILETIME_CHECK === true) return

    const { hashlineRead: map } = state()
    const time = map[sessionID]?.[filepath]
    if (!time)
      throw new Error(
        `You must use hashline_read before hashline_edit on this file. The regular read tool does not provide hashline anchors.`
      )
    const stats = await Bun.file(filepath).stat()
    if (stats.mtime.getTime() > time.getTime())
      throw new Error(
        `File ${filepath} has been modified since it was last read with hashline_read.\nLast modification: ${stats.mtime.toISOString()}\nLast read: ${time.toISOString()}\n\nPlease use hashline_read again before modifying it.`
      )
  }
}
