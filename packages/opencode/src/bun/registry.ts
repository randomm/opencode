// Package registry stub for Bun package management
// Provides NPM registry compatibility and package resolution

export class PackageRegistry {
  constructor(private registry: string = "https://registry.npmjs.org") {}

  async resolve(pkg: string): Promise<{ version: string; latest: string }> {
    const res = await fetch(`${this.registry}/${pkg}`)
    if (!res.ok) throw new Error(`Failed to resolve ${pkg}`)
    const data = (await res.json()) as { "dist-tags": { latest: string } }
    return {
      version: data["dist-tags"].latest,
      latest: data["dist-tags"].latest,
    }
  }

  async getLatestVersion(pkg: string): Promise<string> {
    const info = await this.resolve(pkg)
    return info.latest
  }
}

export default PackageRegistry
