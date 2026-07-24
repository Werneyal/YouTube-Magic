import benchmarks from "../data/benchmarks.json";
import companies from "../data/empresas.json";
import events from "../data/eventos.json";
import frameworks from "../data/frameworks.json";
import models from "../data/modelos.json";
import papers from "../data/papers.json";
import people from "../data/pessoas.json";
import startups from "../data/startups.json";
import tools from "../data/ferramentas.json";
import type {
  DictionaryKey,
  KnowledgeEntityDetails,
} from "./dictionaries";

export type KnowledgeSeed = {
  id: string;
  dictionary: DictionaryKey;
  name: string;
  aliases: string[];
  description: string;
  tags: string[];
  details: KnowledgeEntityDetails;
};

export const dictionarySeeds = [
  ...tools,
  ...companies,
  ...models,
  ...frameworks,
  ...people,
  ...benchmarks,
  ...papers,
  ...startups,
  ...events,
] as KnowledgeSeed[];
