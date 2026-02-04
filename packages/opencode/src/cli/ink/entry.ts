#!/usr/bin/env bun
import { Global } from "@/global"
import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Installation } from "@/installation"
import { startInkTUI } from "./index.tsx"

async function main() {
  try {
    await Global.init()
    await Log.init({
      print: process.stdout.isTTY,
      dev: Installation.isLocal(),
      level: "INFO",
    })

    await Instance.provide({
      directory: process.cwd(),
      init: InstanceBootstrap,
      fn: async () => {
        await startInkTUI()
      },
    })
  } catch (error) {
    console.error("Failed to start oclite:", error)
    process.exit(1)
  }
}

main()
