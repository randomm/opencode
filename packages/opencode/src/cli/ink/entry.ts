#!/usr/bin/env bun
import { Global } from "@/global"
import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { startInkTUI } from "./index.tsx"

async function main() {
  await Global.init()
  await Log.init({ print: false, dev: false, level: "INFO" })

  await Instance.provide({
    directory: process.cwd(),
    init: InstanceBootstrap,
    fn: async () => {
      startInkTUI()
    },
  })
}

main()
