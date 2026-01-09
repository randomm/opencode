import { Tool } from "./tool"
import { z } from "zod"

export const QuestionTool: Tool.Info = {
  id: "question",
  init: async () => ({
    description: "Ask a question to the user",
    parameters: z.object({
      question: z.string().describe("The question to ask the user"),
    }),
    execute: async () => {
      return {
        title: "Question",
        metadata: {},
        output: "Question tool is not implemented in this context",
      }
    },
  }),
}
