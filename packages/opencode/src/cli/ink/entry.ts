#!/usr/bin/env bun
import { Global } from "@/global"
import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Installation } from "@/installation"
import { startInkTUI } from "./index.tsx"

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

    // For oclite, skip the heavy Instance.provide and run TUI directly
    // This is a lightweight version that doesn't need full project bootstrap
    await startInkTUI()
  } catch (error) {
    console.error("Failed to start oclite:", error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
