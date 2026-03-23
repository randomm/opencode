import { z, type ZodType } from "zod/v4"

const standardErrorObject = z.object({
  error: z.object({
    message: z.string(),

    // The additional information below is handled loosely to support
    // OpenAI-compatible providers that have slightly different error
    // responses:
    type: z.string().nullish(),
    param: z.any().nullish(),
    code: z.union([z.string(), z.number()]).nullish(),
  }).passthrough(),
}).strict()

const wrappedErrorObject = z.object({
  status_code: z.number(),
  error: z.object({
    message: z.string(),
    type: z.string().nullish(),
    param: z.any().nullish(),
    code: z.union([z.string(), z.number()]).nullish(),
    id: z.string().nullish(),
  }).passthrough(),
})

export const openaiCompatibleErrorDataSchema = z.union([
  standardErrorObject,
  wrappedErrorObject,
])

export type OpenAICompatibleErrorData = z.infer<typeof openaiCompatibleErrorDataSchema>

export type ProviderErrorStructure<T> = {
  errorSchema: ZodType<T>
  errorToMessage: (error: T) => string
  isRetryable?: (response: Response, error?: T) => boolean
}

export const defaultOpenAICompatibleErrorStructure: ProviderErrorStructure<OpenAICompatibleErrorData> = {
  errorSchema: openaiCompatibleErrorDataSchema,
  errorToMessage: (data) => data.error.message,
}
