/** Apply Metaverse's defaults below the user's profile patch. */
export function configureVeniceDefaults(source) {
  const upstreamModel = `    - id: agent-default-model
      name: '@deepseek-ai/dsh-agent-default-model'
      config:
        provider: deepseek-official
        model: deepseek-flash`;
  const selectedModel = `    - id: agent-default-model
      name: '@deepseek-ai/dsh-agent-default-model'
      config:
        provider: venice
        model: qwen-3-6-plus`;
  const provider = `    - id: llm-pi-ai
      name: '@deepseek-ai/dsh-llm-pi-ai'`;
  const configuredProvider = `    # metaverse-venice-defaults: user profile edits override these defaults.
    - id: llm-pi-ai
      name: '@deepseek-ai/dsh-llm-pi-ai'
      config:
        providers:
          venice:
            displayName: Venice
            apiKeyEnv: VENICE_API_KEY
            api: openai-completions
            baseURL: https://api.venice.ai/api/v1
            models:
              - id: venice-uncensored-1-2
                name: Venice Uncensored 1.2
                contextWindow: 131072
                maxTokens: 8192
                input:
                  - text
                  - image
                reasoningEfforts: false
              - id: gemma-4-uncensored
                name: Gemma 4 Uncensored
                contextWindow: 256000
                maxTokens: 8192
                input:
                  - text
                  - image
                reasoningEfforts: false
              - id: qwen-3-6-plus
                name: Qwen 3.6 Plus Uncensored
                contextWindow: 1000000
                maxTokens: 65536
                input:
                  - text
                  - image
                reasoningEfforts: false`;

  if (source.includes("# metaverse-venice-defaults")) {
    const modelBlock =
      /    - id: agent-default-model\n      name: '@deepseek-ai\/dsh-agent-default-model'\n      config:\n        provider: venice\n        model: [^\n]+/u;
    const providerBlock =
      /    # metaverse-venice-defaults:[\s\S]*?(?=\n\n    - id: session-persistence-jsonl)/u;
    if (!modelBlock.test(source) || !providerBlock.test(source))
      throw new Error("Pinned Harness model defaults changed.");
    return source
      .replace(modelBlock, selectedModel)
      .replace(providerBlock, configuredProvider);
  }
  if (!source.includes(upstreamModel) || !source.includes(provider))
    throw new Error("Pinned Harness model defaults changed.");
  return source
    .replace(upstreamModel, selectedModel)
    .replace(provider, configuredProvider);
}
