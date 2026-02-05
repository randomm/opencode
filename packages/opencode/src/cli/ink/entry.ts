#!/usr/bin/env bun

import { Global } from "@/global"
import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Installation } from "@/installation"
import { startInkTUI } from "./index.tsx"
import { createSpinner } from "./spinner"
import { Provider } from "@/provider/provider"
import { Agent } from "@/agent/agent"

async function main() {
  try {
    // Check for TTY - oclite requires interactive terminal
    if (!process.stdout.isTTY) {
      console.error("Error: oclite requires an interactive terminal")
      console.error("Please run this command directly in a terminal, not through pipes or scripts")
      process.exit(1)
    }

    await Global.init()

    // Disable Log printing to stdout - Ink owns stdout for TUI rendering
    await Log.init({
      print: false,
      dev: Installation.isLocal(),
      level: "INFO",
    })

    process.on("unhandledRejection", (e) => {
      Log.Default.error("rejection", {
        e: e instanceof Error ? e.message : e,
      })
    })

    process.on("uncaughtException", (e) => {
      Log.Default.error("exception", {
        e: e instanceof Error ? e.message : e,
      })
    })

    // Show spinner during bootstrap
    const spinner = createSpinner("Starting oclite...")

    // Initialize Instance for SDK integration
    try {
      await Instance.provide({
        directory: process.cwd(),
        init: InstanceBootstrap,
        fn: async () => {
          // ISSUE FIX #6: Add timeout to bootstrap
          const bootstrap = Promise.all([Provider.list(), Agent.list()])
          const timeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Bootstrap timeout after 30s")), 30000)
          })

          // CRITICAL FIX #1: Error handling with timeout
          await Promise.race([bootstrap, timeout])

          spinner.stop(true)

          // CRITICAL FIX #2: Prevent race condition with stdout flush
          await new Promise((resolve) => setTimeout(resolve, 100))

          await startInkTUI()
        },
      })
    } catch (error) {
      // CRITICAL FIX #1: Ensure cursor restoration on error
      spinner.stop(false)
      throw error
    }
  } catch (error) {
    console.error("Failed to start oclite:", error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
