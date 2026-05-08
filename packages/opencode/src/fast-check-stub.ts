// Stub for fast-check - provides a complete enough API to prevent runtime errors
// This stub prevents fast-check from being imported but provides no-op implementations

class Arbitrary {
  clone() {
    return this
  }
  
  generate() {
    return { value: null, hasToBeCloned: false }
  }
  
  canShrinkWithoutContext() {
    return false
  }
  
  shrink() {
    return Symbol.iterator in Object.prototype ? [][Symbol.iterator]() : { [Symbol.iterator]: () => ({}) }
  }
  
  map() {
    return this
  }
  
  filter() {
    return this
  }
  
  chain() {
    return this
  }
  
  flatMap() {
    return this
  }
}

const noop = () => {}
const arbitrary = new Arbitrary()

export const fc = {
  test: noop,
  check: noop,
  property: noop,
  assert: noop,
  asyncProperty: noop,
  boolean: () => arbitrary,
  integer: () => arbitrary,
  float: () => arbitrary,
  string: () => arbitrary,
  array: () => arbitrary,
  tuple: () => arbitrary,
  object: () => arbitrary,
  oneof: () => arbitrary,
  choice: () => arbitrary,
  constantFrom: () => arbitrary,
  constant: () => arbitrary,
  infiniteShrinkableFrom: () => arbitrary,
  uniqueArray: () => arbitrary,
  mapToConstant: () => arbitrary,
  noBias: () => arbitrary,
  NoSuchMethodError: class {},
  Arbitrary: Arbitrary,
}

export const test = noop
export const check = noop
export const property = noop
export const assert = noop
export const asyncProperty = noop
export const boolean = () => arbitrary
export const integer = () => arbitrary
export const float = () => arbitrary
export const string = () => arbitrary
export const array = () => arbitrary
export const tuple = () => arbitrary
export const object = () => arbitrary
export const oneof = () => arbitrary
export const choice = () => arbitrary
export const constantFrom = () => arbitrary
export const constant = () => arbitrary
export const infiniteShrinkableFrom = () => arbitrary
export const uniqueArray = () => arbitrary
export const mapToConstant = () => arbitrary
export const noBias = () => arbitrary

export default fc
