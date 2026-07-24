export const adaptationModels = [
  {
    id: "anthropic/claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    description: "Análise técnica aprofundada",
  },
  {
    id: "openai/gpt-5.4",
    label: "GPT-5.4",
    description: "Estrutura e explicação técnica",
  },
  {
    id: "google/gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    description: "Processamento rápido de documentos",
  },
  {
    id: "moonshotai/kimi-k2.6",
    label: "Kimi K2.6",
    description: "Documentos longos e detalhados",
  },
  {
    id: "meta-llama/llama-4-maverick",
    label: "Llama 4 Maverick",
    description: "Alternativa de código aberto",
  },
] as const;

export type AdaptationModelId = (typeof adaptationModels)[number]["id"];

export function isAdaptationModel(value: string): value is AdaptationModelId {
  return adaptationModels.some((model) => model.id === value);
}
