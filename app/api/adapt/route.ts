import { NextResponse } from "next/server";
import {
  isAdaptationModel,
  type AdaptationModelId,
} from "../../../lib/adaptation-models";
import { adaptationLightSystemPrompt } from "../../../lib/adaptation-light-prompt";
import { adaptationSystemPrompt } from "../../../lib/adaptation-prompt";
import { tutorialSystemPrompt } from "../../../lib/tutorial-prompt";

const maxTranscriptLength = 240_000;
const maxCustomPromptLength = 100_000;

type AdaptationRequest = {
  transcript?: unknown;
  title?: unknown;
  model?: unknown;
  mode?: unknown;
  customPrompt?: unknown;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

function readContent(content: OpenRouterResponse["choices"]) {
  const value = content?.[0]?.message?.content;
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((part) => part.text ?? "")
      .join("")
      .trim();
  }
  return "";
}

export async function POST(request: Request) {
  let body: AdaptationRequest;

  try {
    body = (await request.json()) as AdaptationRequest;
  } catch {
    return errorResponse("A solicitação enviada não é válida.", 400);
  }

  if (typeof body.transcript !== "string" || !body.transcript.trim()) {
    return errorResponse("Este vídeo não possui uma transcrição para adaptar.", 400);
  }

  if (body.transcript.length > maxTranscriptLength) {
    return errorResponse(
      "A transcrição é longa demais para esta primeira adaptação. Escolha um trecho menor ou use uma transcrição mais curta.",
      413,
    );
  }

  if (typeof body.model !== "string" || !isAdaptationModel(body.model)) {
    return errorResponse("Escolha um modelo disponível para a adaptação.", 400);
  }

  if (body.mode !== undefined && body.mode !== "standard" && body.mode !== "light" && body.mode !== "tutorial" && body.mode !== "custom") {
    return errorResponse("Escolha um modo de adaptação disponível.", 400);
  }

  const customPrompt =
    typeof body.customPrompt === "string" ? body.customPrompt.trim() : "";
  if (
    body.mode === "custom" &&
    (!customPrompt || customPrompt.length > maxCustomPromptLength)
  ) {
    return errorResponse(
      "Informe um prompt personalizado válido dentro do limite de tamanho.",
      400,
    );
  }
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return errorResponse(
      "A chave do OpenRouter ainda não foi configurada neste ambiente.",
      503,
    );
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const model: AdaptationModelId = body.model;
  const systemPrompt =
    body.mode === "custom"
      ? customPrompt
      : body.mode === "tutorial"
        ? tutorialSystemPrompt
        : body.mode === "light"
          ? adaptationLightSystemPrompt
          : adaptationSystemPrompt;

  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": new URL(request.url).origin,
        "X-Title": "Vídeo em Foco",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Título do vídeo: ${title || "Não informado"}\n\nTranscrição:\n${body.transcript}`,
          },
        ],
      }),
    });
  } catch {
    return errorResponse(
      "Não foi possível se conectar ao OpenRouter. Tente novamente.",
      502,
    );
  }

  const payload = (await response.json()) as OpenRouterResponse;
  if (!response.ok) {
    const message = payload.error?.message;
    return errorResponse(
      message || "O OpenRouter não conseguiu processar a adaptação agora.",
      response.status === 429 ? 429 : 502,
    );
  }

  const document = readContent(payload.choices);
  if (!document) {
    return errorResponse(
      "O modelo não retornou um documento utilizável. Tente novamente.",
      502,
    );
  }

  return NextResponse.json({ document, model, prompt: systemPrompt });
}









