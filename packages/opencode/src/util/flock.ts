// Stub for missing upstream @/util/flock module
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
