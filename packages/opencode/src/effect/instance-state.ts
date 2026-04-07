// Stub for missing upstream @/effect/instance-state module
// No external dependencies - pure TypeScript implementation

type State = Record<string, unknown>

const stateMap = new Map<string, State>()
const stateFactories = new Map<string, () => State>()

export const InstanceState = {
  make<S extends State>(factory: () => S) {
    const key = Math.random().toString(36)
    stateFactories.set(key, factory)
    return {
      [Symbol.iterator]: function* () {
        let state = stateMap.get(key)
        if (!state) {
          state = factory()
          stateMap.set(key, state)
        }
        yield state as S
      },
    }
  },
  get<S extends State>(iterable: { [Symbol.iterator]: () => Iterator<S> }): { [Symbol.iterator]: () => Iterator<S> } {
    return iterable
  },
}
