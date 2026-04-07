// Stub for missing upstream @/npm module
export namespace Npm {
  export async function add(pkg: string): Promise<{ directory: string }> {
    throw new Error("Npm.add not implemented - needed for plugin system")
  }
}
