import {
  normalizeKnowledgeTerm,
  type DictionaryKey,
  type KnowledgeEntity,
  type KnowledgeEntityDetails,
  type KnowledgeEntityInput,
} from "./dictionaries.ts";

export class KnowledgeValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "KnowledgeValidationError";
    this.status = status;
  }
}

function cleanOptionalValue(value: unknown, label: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new KnowledgeValidationError(`${label} deve ser um texto.`);
  }

  const cleaned = value.trim();
  if (cleaned.length > maxLength) {
    throw new KnowledgeValidationError(
      `${label} deve ter no máximo ${maxLength} caracteres.`,
    );
  }
  return cleaned || undefined;
}

function cleanStringList(
  value: unknown,
  label: string,
  maxItems: number,
  maxLength: number,
) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new KnowledgeValidationError(`${label} deve ser uma lista de textos.`);
  }
  if (value.length > maxItems) {
    throw new KnowledgeValidationError(
      `${label} deve ter no máximo ${maxItems} itens.`,
    );
  }

  const unique = new Map<string, string>();
  for (const item of value) {
    const cleaned = item.trim().replace(/\s+/g, " ");
    if (!cleaned) continue;
    if (cleaned.length > maxLength) {
      throw new KnowledgeValidationError(
        `Cada item de ${label.toLowerCase()} deve ter no máximo ${maxLength} caracteres.`,
      );
    }
    unique.set(normalizeKnowledgeTerm(cleaned), cleaned);
  }
  return [...unique.values()];
}

export function sanitizeKnowledgeEntityInput(
  value: unknown,
): KnowledgeEntityInput {
  if (!value || typeof value !== "object") {
    throw new KnowledgeValidationError("Envie os dados da entidade.");
  }

  const input = value as Record<string, unknown>;
  if (typeof input.name !== "string" || !input.name.trim()) {
    throw new KnowledgeValidationError("Informe o nome correto da entidade.");
  }

  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length > 120) {
    throw new KnowledgeValidationError(
      "O nome deve ter no máximo 120 caracteres.",
    );
  }

  const aliases = cleanStringList(input.aliases, "Aliases", 50, 120).filter(
    (alias) => normalizeKnowledgeTerm(alias) !== normalizeKnowledgeTerm(name),
  );
  const tags = cleanStringList(input.tags, "Tags", 20, 60);
  const rawDetails =
    input.details && typeof input.details === "object"
      ? (input.details as Record<string, unknown>)
      : {};

  const details: KnowledgeEntityDetails = {
    company: cleanOptionalValue(rawDetails.company, "Empresa", 120),
    role: cleanOptionalValue(rawDetails.role, "Papel", 120),
    category: cleanOptionalValue(rawDetails.category, "Categoria", 120),
    family: cleanOptionalValue(rawDetails.family, "Família", 120),
    website: cleanOptionalValue(rawDetails.website, "Site", 500),
  };

  if (details.website) {
    try {
      const url = new URL(details.website);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      throw new KnowledgeValidationError(
        "Informe um site válido começando com http:// ou https://.",
      );
    }
  }

  return {
    name,
    aliases,
    description:
      cleanOptionalValue(input.description, "Descrição", 1_500) ?? "",
    tags,
    details,
  };
}

export function findKnowledgeConflict(
  dictionary: DictionaryKey,
  candidate: KnowledgeEntityInput,
  entities: KnowledgeEntity[],
  excludedId?: string,
) {
  const candidateName = normalizeKnowledgeTerm(candidate.name);
  const candidateAliases = new Set(
    (candidate.aliases ?? []).map(normalizeKnowledgeTerm),
  );

  for (const entity of entities) {
    if (entity.id === excludedId) continue;

    const entityName = normalizeKnowledgeTerm(entity.name);
    const entityAliases = new Set(entity.aliases.map(normalizeKnowledgeTerm));

    if (entity.dictionary === dictionary && entityName === candidateName) {
      return `Já existe uma entidade chamada “${entity.name}” em ${dictionary}.`;
    }
    if (entityAliases.has(candidateName)) {
      return `O nome “${candidate.name}” já está cadastrado como alias de “${entity.name}”.`;
    }
    for (const alias of candidateAliases) {
      if (alias === entityName || entityAliases.has(alias)) {
        const original =
          candidate.aliases?.find(
            (item) => normalizeKnowledgeTerm(item) === alias,
          ) ?? alias;
        return `O alias “${original}” já está associado a “${entity.name}”.`;
      }
    }
  }

  return null;
}
