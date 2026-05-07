import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"
import { Instance } from "../project/instance"
import { Log } from "../util/log"
import { FileIgnore } from "./ignore"
import { Config } from "../config/config"
import path from "path"
// @ts-ignore
import { createWrapper } from "@parcel/watcher/wrapper"
import { lazy } from "@/util/lazy"
import { withTimeout } from "@/util/timeout"
import type ParcelWatcher from "@parcel/watcher"
import { $ } from "bun"
import { Flag } from "@/flag/flag"
import { readdir } from "fs/promises"
import chokidar, { type ChokidarOptions } from "chokidar"

const SUBSCRIBE_TIMEOUT_MS = 10_000

declare const OPENCODE_LIBC: string | undefined

export namespace FileWatcher {
  const log = Log.create({ service: "file.watcher" })

  export const Event = {
    Updated: BusEvent.define(
      "file.watcher.updated",
      z.object({
        file: z.string(),
        event: z.union([z.literal("add"), z.literal("change"), z.literal("unlink")]),
      }),
    ),
  }

  const normalizeError = (err: unknown): Error => {
    if (err instanceof Error) return err
    if (typeof err === "string") return new Error(err)
    if (err && typeof err === "object" && "message" in err) {
      return new Error(String(err.message))
    }
    return new Error("Unknown watcher error")
  }

  const watcher = lazy((): typeof import("@parcel/watcher") => {
    try {
      const binding = require(
        `@parcel/watcher-${process.platform}-${process.arch}${process.platform === "linux" ? `-${OPENCODE_LIBC || "glibc"}` : ""}`,
      )
      return createWrapper(binding) as typeof import("@parcel/watcher")
    } catch (error) {
      log.info("file watcher using chokidar fallback")

      const chokidarAdapter: typeof import("@parcel/watcher") = {
        subscribe: async (dir: string, callback: ParcelWatcher.SubscribeCallback, options?: ParcelWatcher.Options) => {
          return new Promise((resolve, reject) => {
            let closed = false
            let resolved = false

            const watcherOptions: ChokidarOptions = {
              ignored: options?.ignore || [],
              persistent: true,
              ignoreInitial: true,
              usePolling: options?.backend === "fs-events" ? false : undefined,
            }

            const watcher = chokidar.watch(dir, watcherOptions)

            const eventMap: Record<string, ParcelWatcher.EventType> = {
              add: "create",
              addDir: "create",
              change: "update",
              unlink: "delete",
              unlinkDir: "delete",
            }

            watcher.on("all", (eventType: string, filepath: string) => {
              if (closed) return
              const mappedType = eventMap[eventType]
              if (mappedType) {
                callback(null, [{ type: mappedType, path: filepath }])
              }
            })

            watcher.once("ready", () => {
              if (closed) return
              resolved = true
              watcher.removeAllListeners("error")

              watcher.on("error", (err: unknown) => {
                if (closed) return
                callback(normalizeError(err), [])
              })

              resolve({
                unsubscribe: async () => {
                  closed = true
                  await watcher.close()
                },
              })
            })

            watcher.once("error", (err: unknown) => {
              if (resolved) return
              closed = true
              watcher.close().catch((closeErr) => {
                log.warn("failed to close watcher during error handling", { error: closeErr })
              })
              reject(normalizeError(err))
            })
          })
        },
        unsubscribe: async () => {
          // No-op for module-level unsubscribe
        },
        writeSnapshot: async () => {
          throw new Error("writeSnapshot not supported with chokidar fallback")
        },
        getEventsSince: async () => {
          throw new Error("getEventsSince not supported with chokidar fallback")
        },
      }

      return chokidarAdapter
    }
  })

  const state = Instance.state(
    async () => {
      if (Instance.project.vcs !== "git") return {}
      log.info("init")
      const cfg = await Config.get()
      const backend = (() => {
        if (process.platform === "win32") return "windows"
        if (process.platform === "darwin") return "fs-events"
        if (process.platform === "linux") return "inotify"
      })()
      if (!backend) {
        log.error("watcher backend not supported", { platform: process.platform })
        return {}
      }
      log.info("watcher backend", { platform: process.platform, backend })

      const w = watcher()
      const subscribe: ParcelWatcher.SubscribeCallback = (err, evts) => {
        if (err) return
        for (const evt of evts) {
          if (evt.type === "create") Bus.publish(Event.Updated, { file: evt.path, event: "add" })
          if (evt.type === "update") Bus.publish(Event.Updated, { file: evt.path, event: "change" })
          if (evt.type === "delete") Bus.publish(Event.Updated, { file: evt.path, event: "unlink" })
        }
      }

      const subs: ParcelWatcher.AsyncSubscription[] = []
      const cfgIgnores = cfg.watcher?.ignore ?? []

      if (Flag.OPENCODE_EXPERIMENTAL_FILEWATCHER) {
        const pending = w.subscribe(Instance.directory, subscribe, {
          ignore: [...FileIgnore.PATTERNS, ...cfgIgnores],
          backend,
        })
        const sub = await withTimeout(pending, SUBSCRIBE_TIMEOUT_MS).catch((err) => {
          log.error("failed to subscribe to Instance.directory", { error: err })
          pending.then((s) => s.unsubscribe()).catch(() => {})
          return undefined
        })
        if (sub) subs.push(sub)
      }

      const vcsDir = await $`git rev-parse --git-dir`
        .quiet()
        .nothrow()
        .cwd(Instance.worktree)
        .text()
        .then((x) => path.resolve(Instance.worktree, x.trim()))
        .catch(() => undefined)
      if (vcsDir && !cfgIgnores.includes(".git") && !cfgIgnores.includes(vcsDir)) {
        const gitDirContents = await readdir(vcsDir).catch(() => [])
        const ignoreList = gitDirContents.filter((entry) => entry !== "HEAD")
        const pending = w.subscribe(vcsDir, subscribe, {
          ignore: ignoreList,
          backend,
        })
        const sub = await withTimeout(pending, SUBSCRIBE_TIMEOUT_MS).catch((err) => {
          log.error("failed to subscribe to vcsDir", { error: err })
          pending.then((s) => s.unsubscribe()).catch(() => {})
          return undefined
        })
        if (sub) subs.push(sub)
      }

      return { subs }
    },
    async (state) => {
      if (!state.subs) return
      await Promise.all(state.subs.map((sub) => sub?.unsubscribe()))
    },
  )

  export function init() {
    if (Flag.OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER) {
      return
    }
    state()
  }
}
