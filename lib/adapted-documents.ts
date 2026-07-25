export type AdaptedDocumentSummary = {
  id: string;
  model: string;
  createdAt: string;
};

export type AdaptedDocument = AdaptedDocumentSummary & {
  content: string;
};

export type AdaptedDocumentInput = {
  model: string;
  content: string;
};

export class AdaptedDocumentValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdaptedDocumentValidationError";
    this.status = status;
  }
}

export function sanitizeAdaptedDocumentInput(
  value: unknown,
): AdaptedDocumentInput {
  if (!value || typeof value !== "object") {
    throw new AdaptedDocumentValidationError("Documento inválido.");
  }

  const { model, content } = value as Record<string, unknown>;
  if (typeof model !== "string" || !model.trim() || model.length > 160) {
    throw new AdaptedDocumentValidationError("Modelo inválido.");
  }
  if (
    typeof content !== "string" ||
    !content.trim() ||
    content.length > 500_000
  ) {
    throw new AdaptedDocumentValidationError(
      "O conteúdo do documento é inválido ou longo demais.",
    );
  }

  return { model: model.trim(), content: content.trim() };
}
