import { InstanceBootstrap } from "../project/bootstrap"
import { Instance } from "../project/instance"

export async function bootstrap<T>(directory: string, cb: () => Promise<T>, onProgress?: (step: string) => void) {
  return Instance.provide({
    directory,
    init: () => InstanceBootstrap(onProgress),
    fn: async () => {
      try {
        const result = await cb()
        return result
      } finally {
        await Instance.dispose()
      }
    },
  })
}
