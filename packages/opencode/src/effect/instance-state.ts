// Stub for missing upstream @/effect/instance-state module
import { Effect } from "effect"

type State = Record<string, unknown>

const stateMap = new Map<string, State>()
const stateFactories = new Map<string, () => State>()

export const InstanceState = {
  make<S extends State>(factory: () => S) {
    const key = Math.random().toString(36)
    stateFactories.set(key, factory)
    return Effect.sync(() => {
      let state = stateMap.get(key)
      if (!state) {
        state = factory()
        stateMap.set(key, state)
      }
      return state as S
    })
  },
  get<S extends State>(effect: Effect.Effect<S>): Effect.Effect<S> {
    return effect
  },
}
