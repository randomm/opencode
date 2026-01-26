import path from "path"
import { Global } from "../global"
import fs from "fs/promises"
import z from "zod"
import { Lock } from "../util/lock"

export const OAUTH_DUMMY_KEY = "opencode-oauth-dummy-key"

export namespace Auth {
  export const Oauth = z
    .object({
      type: z.literal("oauth"),
      refresh: z.string(),
      access: z.string(),
      expires: z.number(),
      accountId: z.string().optional(),
      enterpriseUrl: z.string().optional(),
    })
    .meta({ ref: "OAuth" })

  export const Api = z
    .object({
      type: z.literal("api"),
      key: z.string(),
    })
    .meta({ ref: "ApiAuth" })

  export const WellKnown = z
    .object({
      type: z.literal("wellknown"),
      key: z.string(),
      token: z.string(),
    })
    .meta({ ref: "WellKnownAuth" })

  export const Info = z.discriminatedUnion("type", [Oauth, Api, WellKnown]).meta({ ref: "Auth" })
  export type Info = z.infer<typeof Info>

  const filepath = path.join(Global.Path.data, "auth.json")

  export async function get(providerID: string) {
    const auth = await all()
    return auth[providerID]
  }

  export async function all(): Promise<Record<string, Info>> {
    const release = await Lock.read("auth")
    try {
      const file = Bun.file(filepath)
      
      if (!(await file.exists())) return {}
      
      const data = await file.json()
      
      if (typeof data !== "object" || data === null) {
        throw new Error("auth.json contains invalid data")
      }
      
      return Object.entries(data).reduce(
        (acc, [key, value]) => {
          const parsed = Info.safeParse(value)
          if (!parsed.success) return acc
          acc[key] = parsed.data
          return acc
        },
        {} as Record<string, Info>,
      )
    } finally {
      release[Symbol.dispose]()
    }
  }

  export async function set(key: string, info: Info) {
    const release = await Lock.write("auth")
    try {
      const file = Bun.file(filepath)
      const exists = await file.exists()
      const rawData = exists ? await file.json() : null
      const data: Record<string, Info> = {}

      if (typeof rawData === "object" && rawData !== null) {
        Object.entries(rawData).forEach(([k, v]) => {
          const parsed = Info.safeParse(v)
          if (parsed.success) data[k] = parsed.data
        })
      }

      data[key] = info
      await Bun.write(file, JSON.stringify(data, null, 2))
      await fs.chmod(filepath, 0o600)
    } finally {
      release[Symbol.dispose]()
    }
  }

  export async function remove(key: string) {
    const release = await Lock.write("auth")
    try {
      const file = Bun.file(filepath)
      const exists = await file.exists()
      const rawData = exists ? await file.json() : null
      const data: Record<string, Info> = {}

      if (typeof rawData === "object" && rawData !== null) {
        Object.entries(rawData).forEach(([k, v]) => {
          const parsed = Info.safeParse(v)
          if (parsed.success) data[k] = parsed.data
        })
      }

      delete data[key]
      await Bun.write(file, JSON.stringify(data, null, 2))
      await fs.chmod(filepath, 0o600)
    } finally {
      release[Symbol.dispose]()
    }
  }
}
