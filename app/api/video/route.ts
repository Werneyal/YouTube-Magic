import { NextResponse } from "next/server";
import { getPublicTranscript } from "../../../lib/transcript";
import {
  extractYouTubeVideoId,
  getVideoCardData,
  VideoServiceError,
} from "../../../lib/youtube";

type RequestBody = {
  url?: unknown;
};

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return errorResponse(
      "INVALID_JSON",
      "A solicitação enviada não é válida.",
      400,
    );
  }

  if (typeof body.url !== "string" || body.url.length > 2_048) {
    return errorResponse(
      "INVALID_URL",
      "Informe uma URL válida do YouTube.",
      400,
    );
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return errorResponse(
      "MISSING_API_KEY",
      "A chave da API do YouTube ainda não foi configurada neste ambiente.",
      503,
    );
  }

  try {
    const videoId = extractYouTubeVideoId(body.url);
    const result = await getVideoCardData(videoId, apiKey, {
      transcriptProvider: getPublicTranscript,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof VideoServiceError) {
      return errorResponse(error.code, error.message, error.status);
    }

    return errorResponse(
      "UNEXPECTED_ERROR",
      "Ocorreu um erro inesperado ao analisar o vídeo.",
      500,
    );
  }
}
