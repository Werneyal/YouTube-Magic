export type AdaptedDocumentSummary = {
  id: string;
  model: string;
  createdAt: string;
};

export type AdaptedDocument = AdaptedDocumentSummary & {
  content: string;
  prompt: string;
};

export type AdaptedDocumentInput = {
  model: string;
  content: string;
  prompt: string;
};

export class AdaptedDocumentValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdaptedDocumentValidationError";
    this.status = status;
  }
}

export function sanitizeAdaptedDocumentContent(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 500_000
  ) {
    throw new AdaptedDocumentValidationError(
      "O conteúdo do documento é inválido ou longo demais.",
    );
  }

  return value.trim();
}

export function sanitizeAdaptedDocumentInput(
  value: unknown,
): AdaptedDocumentInput {
  if (!value || typeof value !== "object") {
    throw new AdaptedDocumentValidationError("Documento inválido.");
  }

  const { model, content, prompt } = value as Record<string, unknown>;
  if (typeof model !== "string" || !model.trim() || model.length > 160) {
    throw new AdaptedDocumentValidationError("Modelo inválido.");
  }
  if (
    typeof prompt !== "string" ||
    !prompt.trim() ||
    prompt.length > 100_000
  ) {
    throw new AdaptedDocumentValidationError("O prompt utilizado é inválido.");
  }

  return {
    model: model.trim(),
    content: sanitizeAdaptedDocumentContent(content),
    prompt: prompt.trim(),
  };
}
