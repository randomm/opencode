import z from "zod"
import { type Tool as AITool, tool, jsonSchema, type ToolCallOptions } from "ai"
import { Agent } from "../agent/agent"
import { Provider } from "../provider/provider"
import { ProviderTransform } from "../provider/transform"
import { Plugin } from "../plugin"
import { ToolRegistry } from "../tool/registry"
import { MCP } from "../mcp"
import { Log } from "../util/log"
import { Tool } from "../tool/tool"
import { PermissionNext } from "../permission/next"
import { Session } from "."
import { MessageV2 } from "./message-v2"
import { Identifier } from "../id/id"
import { Truncate } from "../tool/truncation"
import { SessionProcessor } from "./processor"

const log = Log.create({ service: "session.tools" })

export interface ResolveToolsInput {
  agent: Agent.Info
  model: Provider.Model
  session: Session.Info
  tools?: Record<string, boolean>
  processor: SessionProcessor.Info
  bypassAgentCheck: boolean
}

export async function resolveTools(input: ResolveToolsInput): Promise<Record<string, AITool>> {
  using _ = log.time("resolveTools")
  const tools: Record<string, AITool> = {}
  const sessionMessages = await Session.messages({ sessionID: input.session.id })

  const context = (args: Record<string, unknown>, options: ToolCallOptions): Tool.Context => ({
    sessionID: input.session.id,
    abort: options.abortSignal!,
    messageID: input.processor.message.id,
    callID: options.toolCallId,
    extra: { model: input.model, bypassAgentCheck: input.bypassAgentCheck },
    agent: input.agent.name,
    messages: sessionMessages,
    metadata: async (val: { title?: string; metadata?: Record<string, unknown> }) => {
      const match = input.processor.partFromToolCall(options.toolCallId)
      if (match && match.state.status === "running") {
        await Session.updatePart({
          ...match,
          state: {
            title: val.title,
            metadata: val.metadata,
            status: "running",
            input: args,
            time: {
              start: Date.now(),
            },
          },
        })
      }
    },
    async ask(req) {
      await PermissionNext.ask({
        ...req,
        sessionID: input.session.id,
        tool: { messageID: input.processor.message.id, callID: options.toolCallId },
        ruleset: PermissionNext.merge(input.agent.permission, input.session.permission ?? []),
      })
    },
  })

  for (const item of await ToolRegistry.tools(
    { modelID: input.model.api.id, providerID: input.model.providerID },
    input.agent,
  )) {
    const schema = ProviderTransform.schema(input.model, z.toJSONSchema(item.parameters))

    // Type assertion required for AI SDK compatibility
    // The AI SDK has stricter type requirements than our Zod schemas support
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools[item.id] = tool({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      id: item.id as any,
      description: item.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: jsonSchema(schema as any),
      async execute(args, options) {
        const ctx = context(args as Record<string, unknown>, options)
        await Plugin.trigger(
          "tool.execute.before",
          {
            tool: item.id,
            sessionID: ctx.sessionID,
            callID: ctx.callID,
          },
          {
            args,
          },
        )
        try {
          const result = await item.execute(args, ctx)
          await Plugin.trigger(
            "tool.execute.after",
            {
              tool: item.id,
              sessionID: ctx.sessionID,
              callID: ctx.callID,
            },
            result,
          )
          return result
        } catch (e) {
          if (typeof e === "object" && e !== null && "name" in e && e.name === "AbortError") {
            throw e
          }
          if (e instanceof DOMException && e.name === "AbortError") {
            throw e
          }
          throw e
        }
      },
    })
  }

  for (const [key, item] of Object.entries(await MCP.tools())) {
    const execute = item.execute
    if (!execute) {
      log.warn("MCP tool skipped: no execute function", { tool: key })
      continue
    }

    // Wrap execute to add plugin hooks and format output
    item.execute = async (args, opts) => {
      const ctx = context(args, opts)

      await Plugin.trigger(
        "tool.execute.before",
        {
          tool: key,
          sessionID: ctx.sessionID,
          callID: opts.toolCallId,
        },
        {
          args,
        },
      )

      await ctx.ask({
        permission: key,
        metadata: {},
        patterns: ["*"],
        always: ["*"],
      })

      let result = await execute(args, opts)

      await Plugin.trigger(
        "tool.execute.after",
        {
          tool: key,
          sessionID: ctx.sessionID,
          callID: opts.toolCallId,
        },
        result,
      )

      const textParts: string[] = []
      const attachments: MessageV2.FilePart[] = []

      for (const contentItem of result.content) {
        switch (contentItem.type) {
          case "text":
            textParts.push(contentItem.text)
            break
          case "image":
            attachments.push({
              id: Identifier.ascending("part"),
              sessionID: input.session.id,
              messageID: input.processor.message.id,
              type: "file",
              mime: contentItem.mimeType,
              url: `data:${contentItem.mimeType};base64,${contentItem.data}`,
            })
            break
          case "resource": {
            const { resource } = contentItem
            if (resource.text) {
              textParts.push(resource.text)
            }
            if (resource.blob) {
              attachments.push({
                id: Identifier.ascending("part"),
                sessionID: input.session.id,
                messageID: input.processor.message.id,
                type: "file",
                mime: resource.mimeType ?? "application/octet-stream",
                url: `data:${resource.mimeType ?? "application/octet-stream"};base64,${resource.blob}`,
                filename: resource.uri,
              })
            }
            break
          }
        }
      }

      const truncated = await Truncate.output(textParts.join("\n\n"), {}, input.agent)
      const metadata = {
        ...(result.metadata ?? {}),
        truncated: truncated.truncated,
        ...(truncated.truncated && { outputPath: truncated.outputPath }),
      }

      return {
        title: "",
        metadata,
        output: truncated.content,
        attachments,
        content: result.content, // directly return content to preserve ordering when outputting to model
      }
    }
    tools[key] = item
  }

  return tools
}
