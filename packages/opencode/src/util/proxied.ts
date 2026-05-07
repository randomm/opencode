// Proxied utility for handling proxied values and lazy evaluation

export function proxied<T>(fn: () => T): T {
  return new Proxy({} as T, {
    get(_, prop) {
      const result = fn()
      return Reflect.get(result, prop)
    },
  })
}

export default proxied
