import fs from "fs/promises"
import path from "path"
import os from "os"
import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"

const app = "opencode"

let initialized = false

export async function init() {
  if (initialized) return

  await Promise.all([
    fs.mkdir(Global.Path.data, { recursive: true }),
    fs.mkdir(Global.Path.config, { recursive: true }),
    fs.mkdir(Global.Path.state, { recursive: true }),
    fs.mkdir(Global.Path.log, { recursive: true }),
    fs.mkdir(Global.Path.bin, { recursive: true }),
  ])

  const CACHE_VERSION = "18"

  const version = await Bun.file(path.join(Global.Path.cache, "version"))
    .text()
    .catch(() => "0")

  if (version !== CACHE_VERSION) {
    try {
      const contents = await fs.readdir(Global.Path.cache)
      await Promise.all(
        contents.map((item) =>
          fs.rm(path.join(Global.Path.cache, item), {
            recursive: true,
            force: true,
          }),
        ),
      )
    } catch (e) {}
    await Bun.file(path.join(Global.Path.cache, "version")).write(CACHE_VERSION)
  }

  initialized = true
}

export const Global = {
  init,
  Path: {
    // Allow override via OPENCODE_TEST_HOME for test isolation
    get home() {
      return process.env.OPENCODE_TEST_HOME || os.homedir()
    },
    get data() {
      return path.join(xdgData!, app)
    },
    get bin() {
      return path.join(this.data, "bin")
    },
    get log() {
      return path.join(this.data, "log")
    },
    get cache() {
      return path.join(xdgCache!, app)
    },
    // Resolve config relative to OPENCODE_TEST_HOME when set
    get config() {
      return process.env.OPENCODE_TEST_HOME
        ? path.join(process.env.OPENCODE_TEST_HOME, ".config", app)
        : path.join(xdgConfig!, app)
    },
    get state() {
      return path.join(xdgState!, app)
    },
    // Allow overriding models.dev URL for offline deployments
    get modelsDevUrl() {
      return process.env.OPENCODE_MODELS_URL || "https://models.dev"
    },
  },
}

export namespace GlobalNS {
  export const Path = Global.Path
}
