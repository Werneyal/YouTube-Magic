export const dictionariesConfig = [
  {
    key: "ferramentas",
    label: "Ferramentas",
    description: "Aplicativos, plataformas, agentes e serviços de IA.",
  },
  {
    key: "empresas",
    label: "Empresas",
    description: "Empresas e organizações do ecossistema de IA.",
  },
  {
    key: "modelos",
    label: "Modelos",
    description: "Modelos e famílias de modelos de inteligência artificial.",
  },
  {
    key: "frameworks",
    label: "Frameworks",
    description: "Frameworks, bibliotecas e kits de desenvolvimento.",
  },
  {
    key: "pessoas",
    label: "Pessoas",
    description: "Fundadores, pesquisadores, executivos e criadores.",
  },
  {
    key: "benchmarks",
    label: "Benchmarks",
    description: "Avaliações e conjuntos de testes para modelos.",
  },
  {
    key: "papers",
    label: "Papers",
    description: "Artigos científicos relevantes para inteligência artificial.",
  },
  {
    key: "startups",
    label: "Startups",
    description: "Novas empresas e projetos emergentes de IA.",
  },
  {
    key: "eventos",
    label: "Eventos",
    description: "Conferências, anúncios e lançamentos importantes.",
  },
] as const;

export type DictionaryKey = (typeof dictionariesConfig)[number]["key"];

export type KnowledgeEntityDetails = {
  company?: string;
  role?: string;
  category?: string;
  family?: string;
  website?: string;
};

export type KnowledgeEntity = {
  id: string;
  dictionary: DictionaryKey;
  name: string;
  aliases: string[];
  description: string;
  tags: string[];
  details: KnowledgeEntityDetails;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeEntityInput = {
  name: string;
  aliases?: string[];
  description?: string;
  tags?: string[];
  details?: KnowledgeEntityDetails;
};

export type DictionarySummary = {
  key: DictionaryKey;
  label: string;
  description: string;
  entityCount: number;
  aliasCount: number;
};

const dictionaryKeys = new Set<string>(
  dictionariesConfig.map((dictionary) => dictionary.key),
);

export function isDictionaryKey(value: string): value is DictionaryKey {
  return dictionaryKeys.has(value);
}

export function getDictionaryConfig(key: DictionaryKey) {
  return dictionariesConfig.find((dictionary) => dictionary.key === key)!;
}

export function normalizeKnowledgeTerm(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}
