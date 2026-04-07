// Stub for missing upstream @/effect/run-service module
import { Effect, Layer } from "effect"

export const makeRuntime = <I, S>(
  _service: new () => S,
  _layer: Layer.Layer<never, never, I>,
) => {
  return {
    runPromise: async <R>(fn: (svc: S) => Promise<R>): Promise<R> => {
      // This is a simplified stub that doesn't actually run the effect runtime
      // Real implementation would use Effect.runPromise
      throw new Error("makeRuntime stub called - plugin system needs rework")
    },
  }
}
