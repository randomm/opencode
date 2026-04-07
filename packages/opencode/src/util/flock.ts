/**
 * Flock stub for plugin system compatibility.
 *
 * NOTE: This is a no-op implementation. Concurrent plugin operations
 * may have race conditions. For production use with parallel plugin
 * loading, implement file-based locking using Bun.file() atomic operations.
 *
 * Used by: plugin/meta.ts, plugin/install.ts
 */
export const Flock = {
  acquire: async (_name: string) => {
    return {
      [Symbol.asyncDispose]: async () => {},
    }
  },
  withLock: async <T>(_name: string, fn: () => Promise<T>): Promise<T> => {
    return fn()
  },
}
