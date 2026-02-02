import { write, fg, style } from "./terminal"

const PAD = "  "
import { select } from "./select"
import { Session } from "../../session"
import { Instance } from "../../project/instance"
import { Agent } from "../../agent/agent"
import { Provider } from "../../provider/provider"
import { Command } from "../../command"
import { MCP } from "../../mcp"
import { Config } from "../../config/config"
import path from "path"
import { Global } from "../../global"

export interface ModelRecent {
  providerID: string
  modelID: string
}

interface ModelData {
  recent: ModelRecent[]
  favorite: ModelRecent[]
}

export async function loadRecentModels(): Promise<ModelRecent[]> {
  const statePath = Global.Path.state
  const modelFile = path.join(statePath, "model.json")
  const file = Bun.file(modelFile)
  const exists = await file.exists()

  if (!exists) return []

  const data = (await file.json()) as ModelData
  return data.recent || []
}

export async function saveRecentModels(recent: ModelRecent[]): Promise<void> {
  const statePath = Global.Path.state
  const modelFile = path.join(statePath, "model.json")
  const file = Bun.file(modelFile)
  const exists = await file.exists()

  let data: ModelData = { recent: [], favorite: [] }
  if (exists) {
    data = (await file.json()) as ModelData
  }

  data.recent = recent
  await Bun.write(modelFile, JSON.stringify(data))
}

export async function addRecentModel(providerID: string, modelID: string): Promise<void> {
  const recent = await loadRecentModels()
  const newEntry = { providerID, modelID }
  const filtered = recent.filter((r) => !(r.providerID === providerID && r.modelID === modelID))
  filtered.unshift(newEntry)
  const trimmed = filtered.slice(0, 10)
  await saveRecentModels(trimmed)
}

async function listSessions(): Promise<Session.Info[]> {
  const sessions: Session.Info[] = []
  for await (const session of Session.list()) {
    sessions.push(session)
    if (sessions.length >= 10) break
  }
  return sessions.reverse()
}

export async function getAllModels() {
  const providers = await Provider.list()
  const recent = await loadRecentModels()
  const recentSet = new Set(recent.map((r) => `${r.providerID}/${r.modelID}`))
  const allModels: Array<{ label: string; value: string; description?: string }> = []

  for (const [providerID, provider] of Object.entries(providers)) {
    if (!provider.key) continue
    for (const [modelID, model] of Object.entries(provider.models)) {
      allModels.push({
        label: `${model.name} (${providerID})`,
        value: `${providerID}/${modelID}`,
        description: `${model.family || ""}${model.cost.input > 0 ? " • Paid" : " • Free"}`.trim(),
      })
    }
  }

  const options: Array<{
    label?: string
    value?: string
    description?: string
    current?: boolean
    section?: string
    separator?: boolean
  }> = []

  const modelMap = new Map(allModels.map((m) => [m.value, m]))
  const recentModels: Array<{ label: string; value: string; description?: string }> = []
  for (const r of recent) {
    const key = `${r.providerID}/${r.modelID}`
    const model = modelMap.get(key)
    if (model) {
      recentModels.push(model)
    }
  }
  const otherModels = allModels.filter((m) => !recentSet.has(m.value))

  if (recentModels.length > 0) {
    options.push({ section: "Recent", separator: true })
    for (const model of recentModels) {
      options.push({ ...model, separator: false })
    }
  }

  if (otherModels.length > 0) {
    if (recentModels.length > 0) {
      options.push({ section: "All Models", separator: true })
    }
    for (const model of otherModels) {
      options.push({ ...model, separator: false })
    }
  }

  return options
}

interface State {
  currentSessionID: string | null
  currentModel: string | null
  currentAgent: string | undefined
}

interface SetState {
  setSessionID: (id: string | null) => void
  setModel: (model: string | null) => void
  setAgent: (agent: string | undefined) => void
}

export async function handleSessions(state: State, setState: SetState, setParentSession: (id: string) => void) {
  const sessions = await listSessions()
  if (sessions.length === 0) {
    write(`${PAD}${fg.yellow}No sessions found${style.reset}\n\n`)
    return
  }

  const options = sessions.map((session) => ({
    label: session.title,
    value: session.id,
    description: new Date(session.time.created).toLocaleDateString(),
  }))

  const selected = await select(options, `${fg.cyan}Select a session:${style.reset}`)
  if (selected) {
    setState.setSessionID(selected)
    setParentSession(selected)
    write(`${PAD}${fg.green}Session switched${style.reset}\n\n`)
  } else {
    write("\n")
  }
}

export async function handleNew(setState: SetState, setParentSession: (id: string) => void) {
  const session = await Session.createNext({
    directory: Instance.directory,
  })
  setState.setSessionID(session.id)
  setState.setModel(null)
  setParentSession(session.id)
  write(`${PAD}${fg.green}New session started${style.reset}\n\n`)
}

export async function handleAgents(state: State, setState: SetState) {
  const all = await Agent.list()
  const filtered = all.filter((a) => a.mode !== "subagent" && !a.hidden)

  if (filtered.length === 0) {
    write(`${PAD}${fg.red}No agents available${style.reset}\n\n`)
    return
  }

  const options = filtered.map((agent) => ({
    label: `${agent.name} — ${agent.description ?? ""}`,
    value: agent.name,
    current: agent.name === state.currentAgent,
  }))

  const selected = await select(options, `${fg.cyan}Select an agent:${style.reset}`)
  if (selected) {
    setState.setAgent(selected)
    write(`${PAD}${fg.green}Agent switched to ${selected}${style.reset}\n\n`)
  } else {
    write("\n")
  }
}

export async function handleModels(setState: SetState) {
  const models = await getAllModels()
  if (models.length === 0) {
    write(`${PAD}${fg.yellow}No models available${style.reset}\n\n`)
    return
  }
  const selected = await select(models, `${fg.cyan}Select a model:${style.reset}`)
  if (selected) {
    setState.setModel(selected)
    const parts = selected.split("/")
    if (parts.length === 2) {
      await addRecentModel(parts[0], parts[1])
    }
    write(`${PAD}${fg.green}Model switched to ${selected}${style.reset}\n\n`)
  } else {
    write("\n")
  }
}

export async function handleSubagentModel() {
  const models = await getAllModels()
  if (models.length === 0) {
    write(`${PAD}${fg.yellow}No models available${style.reset}\n\n`)
    return
  }
  const selected = await select(models, `${fg.cyan}Select model for subagents:${style.reset}`)
  if (selected) {
    process.env.SUBAGENT_MODEL = selected
    write(`${PAD}${fg.green}Subagent model set to ${selected}${style.reset}\n\n`)
  } else {
    write("\n")
  }
}

export async function handleMcp(): Promise<void> {
  const config = await Config.get()
  const mcpServers = config.mcp ?? {}

  if (Object.keys(mcpServers).length === 0) {
    write(`${PAD}No MCP servers configured.\n`)
    return
  }

  const buildOptions = async () => {
    try {
      const statuses = await MCP.status()
      return Object.keys(mcpServers).map((name) => {
        const status = statuses[name]
        const icon =
          status?.status === "connected"
            ? "✓"
            : status?.status === "disabled"
              ? "○"
              : status?.status === "failed"
                ? "✗"
                : status?.status === "needs_auth"
                  ? "⚠"
                  : "?"
        const desc = status?.status === "failed" ? status.error : (status?.status ?? "unknown")
        return {
          label: `${icon} ${name}`,
          value: name,
          description: desc,
        }
      })
    } catch {
      return []
    }
  }

  const options = await buildOptions()

  await select(options, "Manage MCP servers (space=toggle, r=restart)", {
    onKey: async (key, selected, currentOptions) => {
      if (!selected.value) return Promise.resolve({ action: "continue" as const })

      try {
        if (key === " ") {
          const statuses = await MCP.status()
          const current = statuses[selected.value]
          if (current?.status === "connected") {
            await MCP.disconnect(selected.value)
          } else {
            await MCP.connect(selected.value)
          }
          try {
            const updatedOptions = await buildOptions()
            return Promise.resolve({ action: "update" as const, options: updatedOptions })
          } catch {
            return Promise.resolve({ action: "continue" as const })
          }
        }

        if (key === "r") {
          await MCP.disconnect(selected.value)
          await MCP.connect(selected.value)
          try {
            const updatedOptions = await buildOptions()
            return Promise.resolve({ action: "update" as const, options: updatedOptions })
          } catch {
            return Promise.resolve({ action: "continue" as const })
          }
        }
      } catch {
        return Promise.resolve({ action: "continue" as const })
      }

      return Promise.resolve({ action: "continue" as const })
    },
  })
}

export async function handleCustomCommand(
  name: string,
  args: string,
  command: (name: string, args: string, options: any) => AsyncIterable<any>,
  streamResponse: (source: AsyncIterable<any>, options: any) => Promise<void>,
  state: State,
  setOperationInProgress: (inProgress: boolean) => void,
  freezeBlock: () => void,
  spinner?: { stop: (success: boolean) => void },
) {
  const options = {
    model: state.currentModel || undefined,
    agent: state.currentAgent,
    sessionID: state.currentSessionID || undefined,
  }

  setOperationInProgress(true)
  try {
    const source = command(name, args, options)
    if (spinner) spinner.stop(true)
    await streamResponse(source, options)
  } catch (err) {
    if (spinner) spinner.stop(false)
    freezeBlock()
    const msg = err instanceof Error ? err.message : String(err)
    write(`\n${PAD}${fg.red}Error: ${msg}${style.reset}\n\n`)
  } finally {
    setOperationInProgress(false)
  }
}
