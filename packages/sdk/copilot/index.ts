// GitHub Copilot OpenAI-compatible provider wrapper
// Stub for api import compatibility

let createOpenAICompatible: any = null

export const createOpenaiCompatible = (params: any) => {
  if (!createOpenAICompatible) {
    // Lazy load to avoid breaking when @ai-sdk/openai-compatible is not in bundle context
    createOpenAICompatible = require("@ai-sdk/openai-compatible").createOpenAICompatible
  }
  return createOpenAICompatible(params)
}

export default createOpenaiCompatible
