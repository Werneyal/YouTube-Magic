"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  dictionariesConfig,
  normalizeKnowledgeTerm,
  type DictionaryKey,
  type DictionarySummary,
  type KnowledgeEntity,
} from "../../lib/dictionaries";

type EntityDraft = {
  name: string;
  aliases: string;
  description: string;
  tags: string;
  company: string;
  role: string;
  category: string;
  family: string;
  website: string;
};

const emptyDraft: EntityDraft = {
  name: "",
  aliases: "",
  description: "",
  tags: "",
  company: "",
  role: "",
  category: "",
  family: "",
  website: "",
};

async function readJson(response: Response) {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      payload?.error?.message ?? "Não foi possível concluir esta operação.",
    );
  }
  return payload;
}

function draftFromEntity(entity: KnowledgeEntity): EntityDraft {
  return {
    name: entity.name,
    aliases: entity.aliases.join("\n"),
    description: entity.description,
    tags: entity.tags.join(", "),
    company: entity.details.company ?? "",
    role: entity.details.role ?? "",
    category: entity.details.category ?? "",
    family: entity.details.family ?? "",
    website: entity.details.website ?? "",
  };
}

function listFromText(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function KnowledgeBasePage() {
  const [summaries, setSummaries] = useState<DictionarySummary[]>([]);
  const [selected, setSelected] = useState<DictionaryKey>("ferramentas");
  const [entities, setEntities] = useState<KnowledgeEntity[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [editing, setEditing] = useState<KnowledgeEntity | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draft, setDraft] = useState<EntityDraft>(emptyDraft);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadSummaries = useCallback(async () => {
    const response = await fetch("/api/dictionaries", { cache: "no-store" });
    const payload = await readJson(response);
    setSummaries(payload.dictionaries as DictionarySummary[]);
  }, []);

  const loadEntities = useCallback(async (dictionary: DictionaryKey) => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/dictionaries/${dictionary}`, {
        cache: "no-store",
      });
      const payload = await readJson(response);
      setEntities(payload.entities as KnowledgeEntity[]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar este dicionário.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummaries().catch((requestError) => {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar os dicionários.",
      );
    });
  }, [loadSummaries]);

  useEffect(() => {
    void loadEntities(selected);
  }, [loadEntities, selected]);

  useEffect(() => {
    if (!isEditorOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsEditorOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isEditorOpen]);

  const selectedConfig =
    summaries.find((summary) => summary.key === selected) ??
    dictionariesConfig.find((dictionary) => dictionary.key === selected)!;

  const filteredEntities = useMemo(() => {
    const normalizedQuery = normalizeKnowledgeTerm(query);
    if (!normalizedQuery) return entities;
    return entities.filter((entity) =>
      [entity.name, ...entity.aliases].some((term) =>
        normalizeKnowledgeTerm(term).includes(normalizedQuery),
      ),
    );
  }, [entities, query]);

  const totals = useMemo(
    () => ({
      entities: summaries.reduce(
        (total, dictionary) => total + dictionary.entityCount,
        0,
      ),
      aliases: summaries.reduce(
        (total, dictionary) => total + dictionary.aliasCount,
        0,
      ),
    }),
    [summaries],
  );

  function openNewEntity() {
    setEditing(null);
    setDraft(emptyDraft);
    setError("");
    setFeedback("");
    setIsEditorOpen(true);
  }

  function openEditEntity(entity: KnowledgeEntity) {
    setEditing(entity);
    setDraft(draftFromEntity(entity));
    setError("");
    setFeedback("");
    setIsEditorOpen(true);
  }

  async function saveEntity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setFeedback("");

    const endpoint = editing
      ? `/api/dictionaries/${selected}/${editing.id}`
      : `/api/dictionaries/${selected}`;

    try {
      const response = await fetch(endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          aliases: listFromText(draft.aliases),
          description: draft.description,
          tags: listFromText(draft.tags),
          details: {
            company: draft.company,
            role: draft.role,
            category: draft.category,
            family: draft.family,
            website: draft.website,
          },
        }),
      });
      await readJson(response);
      setFeedback(editing ? "Entidade atualizada." : "Entidade adicionada.");
      setIsEditorOpen(false);
      await Promise.all([loadEntities(selected), loadSummaries()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível salvar a entidade.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteEntity(entity: KnowledgeEntity) {
    if (
      !window.confirm(
        `Excluir “${entity.name}” e seus ${entity.aliases.length} aliases?`,
      )
    ) {
      return;
    }

    setError("");
    setFeedback("");
    try {
      const response = await fetch(
        `/api/dictionaries/${selected}/${entity.id}`,
        { method: "DELETE" },
      );
      await readJson(response);
      setFeedback(`“${entity.name}” foi excluído.`);
      await Promise.all([loadEntities(selected), loadSummaries()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível excluir a entidade.",
      );
    }
  }

  function downloadJson(content: string, filename: string) {
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportDictionary() {
    downloadJson(JSON.stringify(entities, null, 2), `${selected}.json`);
  }

  async function exportAllDictionaries() {
    setError("");
    setFeedback("");
    setIsExportingAll(true);
    try {
      const entries = await Promise.all(
        dictionariesConfig.map(async ({ key }) => {
          const response = await fetch(`/api/dictionaries/${key}`, {
            cache: "no-store",
          });
          const payload = await readJson(response);
          return [key, payload.entities as KnowledgeEntity[]] as const;
        }),
      );
      const grouped = Object.fromEntries(entries) as Record<
        DictionaryKey,
        KnowledgeEntity[]
      >;
      downloadJson(
        JSON.stringify(grouped, null, 2),
        "base-conhecimento.json",
      );
      setFeedback("Todas as bibliotecas foram exportadas.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível exportar todas as bibliotecas.",
      );
    } finally {
      setIsExportingAll(false);
    }
  }

  return (
    <main className="knowledge-page">
      <div className="background-grid" aria-hidden="true" />

      <header className="site-header knowledge-header">
        <a className="brand" href="/" aria-label="Vídeo em Foco — início">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>Vídeo em Foco</span>
        </a>
        <nav className="site-nav" aria-label="Navegação principal">
          <a href="/">Vídeos</a>
          <a className="active" href="/knowledge-base" aria-current="page">
            Base de Conhecimento
          </a>
        </nav>
      </header>

      <section className="knowledge-hero">
        <div>
          <span className="knowledge-eyebrow">Fundação para revisão inteligente</span>
          <h1>
            Base de <em>Conhecimento</em>
          </h1>
          <p>
            Organize nomes corretos e aliases que serão usados para encontrar
            termos suspeitos nas transcrições, sempre com confirmação humana.
          </p>
        </div>
        <dl className="knowledge-metrics">
          <div>
            <dt>Entidades</dt>
            <dd>{totals.entities}</dd>
          </div>
          <div>
            <dt>Aliases</dt>
            <dd>{totals.aliases}</dd>
          </div>
          <div>
            <dt>Dicionários</dt>
            <dd>{dictionariesConfig.length}</dd>
          </div>
        </dl>
      </section>

      <section className="knowledge-workspace" aria-label="Gerenciar dicionários">
        <aside className="dictionary-sidebar">
          <div className="dictionary-sidebar-heading">
            <span>Bibliotecas</span>
            <small>{summaries.length || dictionariesConfig.length}</small>
          </div>
          <div className="dictionary-list">
            {(summaries.length ? summaries : dictionariesConfig).map(
              (dictionary) => (
                <button
                  key={dictionary.key}
                  type="button"
                  className={selected === dictionary.key ? "active" : ""}
                  onClick={() => {
                    setSelected(dictionary.key);
                    setQuery("");
                    setFeedback("");
                  }}
                >
                  <span>
                    <strong>{dictionary.label}</strong>
                    <small>{dictionary.description}</small>
                  </span>
                  <b>
                    {"entityCount" in dictionary
                      ? dictionary.entityCount
                      : "—"}
                  </b>
                </button>
              ),
            )}
          </div>
        </aside>

        <div className="dictionary-content">
          <div className="dictionary-title-row">
            <div>
              <span>Dicionário selecionado</span>
              <h2>{selectedConfig.label}</h2>
              <p>{selectedConfig.description}</p>
            </div>
            <div className="dictionary-actions">
              <button
                className="secondary-action"
                type="button"
                onClick={exportDictionary}
                disabled={!entities.length || isExportingAll}
              >
                Exportar JSON
              </button>
              <button
                className="secondary-action"
                type="button"
                onClick={() => void exportAllDictionaries()}
                disabled={isExportingAll || !summaries.length}
                aria-busy={isExportingAll}
              >
                {isExportingAll ? "Exportando…" : "Exportar todas"}
              </button>
              <button
                className="primary-action"
                type="button"
                onClick={openNewEntity}
              >
                <span aria-hidden="true">+</span>
                Nova entidade
              </button>
            </div>
          </div>

          <label className="knowledge-search">
            <span className="sr-only">Pesquisar por nome ou alias</span>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar por nome correto ou alias…"
            />
            <small>
              {filteredEntities.length}{" "}
              {filteredEntities.length === 1 ? "resultado" : "resultados"}
            </small>
          </label>

          <div className="knowledge-status" aria-live="polite">
            {error && <p className="knowledge-error">{error}</p>}
            {feedback && <p className="knowledge-feedback">{feedback}</p>}
          </div>

          {isLoading ? (
            <div className="knowledge-empty">Carregando entidades…</div>
          ) : filteredEntities.length === 0 ? (
            <div className="knowledge-empty">
              <strong>Nenhuma entidade encontrada.</strong>
              <p>
                {query
                  ? "Tente outra busca ou cadastre o termo correto."
                  : "Adicione a primeira entidade deste dicionário."}
              </p>
            </div>
          ) : (
            <div className="entity-grid">
              {filteredEntities.map((entity) => (
                <article className="entity-card" key={entity.id}>
                  <div className="entity-card-top">
                    <div>
                      <span>{selectedConfig.label}</span>
                      <h3>{entity.name}</h3>
                    </div>
                    <div className="entity-card-menu">
                      <button
                        type="button"
                        onClick={() => openEditEntity(entity)}
                      >
                        Editar
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => void deleteEntity(entity)}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>

                  <p className="entity-description">
                    {entity.description || "Sem descrição cadastrada."}
                  </p>

                  <div className="entity-aliases">
                    <span>Aliases reconhecidos</span>
                    <div>
                      {entity.aliases.length ? (
                        entity.aliases.map((alias) => (
                          <mark key={alias}>{alias}</mark>
                        ))
                      ) : (
                        <small>Nenhum alias</small>
                      )}
                    </div>
                  </div>

                  {(entity.details.company ||
                    entity.details.role ||
                    entity.details.category) && (
                    <dl className="entity-details">
                      {entity.details.company && (
                        <div>
                          <dt>Empresa</dt>
                          <dd>{entity.details.company}</dd>
                        </div>
                      )}
                      {entity.details.role && (
                        <div>
                          <dt>Papel</dt>
                          <dd>{entity.details.role}</dd>
                        </div>
                      )}
                      {entity.details.category && (
                        <div>
                          <dt>Categoria</dt>
                          <dd>{entity.details.category}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer>
        <span>Vídeo em Foco</span>
        <p>A Base de Conhecimento sugere; você mantém a decisão final.</p>
      </footer>

      {isEditorOpen && (
        <div
          className="entity-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsEditorOpen(false);
          }}
        >
          <section
            className="entity-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entity-modal-title"
          >
            <div className="entity-modal-heading">
              <div>
                <span>{selectedConfig.label}</span>
                <h2 id="entity-modal-title">
                  {editing ? "Editar entidade" : "Nova entidade"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                aria-label="Fechar formulário"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveEntity}>
              <label className="form-field full">
                <span>Nome correto *</span>
                <input
                  autoFocus
                  required
                  maxLength={120}
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Claude Code"
                />
              </label>

              <label className="form-field full">
                <span>Aliases — um por linha</span>
                <textarea
                  rows={4}
                  value={draft.aliases}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      aliases: event.target.value,
                    }))
                  }
                  placeholder={"Cloud Code\nClawed Code"}
                />
              </label>

              <label className="form-field full">
                <span>Descrição</span>
                <textarea
                  rows={3}
                  maxLength={1500}
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Explique o que é esta entidade."
                />
              </label>

              <div className="entity-form-grid">
                {(
                  [
                    ["company", "Empresa"],
                    ["role", "Papel"],
                    ["category", "Categoria"],
                    ["family", "Família"],
                  ] as const
                ).map(([field, label]) => (
                  <label className="form-field" key={field}>
                    <span>{label}</span>
                    <input
                      maxLength={120}
                      value={draft[field]}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>

              <label className="form-field full">
                <span>Tags — separadas por vírgula</span>
                <input
                  value={draft.tags}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      tags: event.target.value,
                    }))
                  }
                  placeholder="agente, programação"
                />
              </label>

              <label className="form-field full">
                <span>Site</span>
                <input
                  type="url"
                  value={draft.website}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      website: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                />
              </label>

              {error && <p className="knowledge-error modal-error">{error}</p>}

              <div className="entity-modal-actions">
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className="primary-action"
                  type="submit"
                  disabled={isSaving || !draft.name.trim()}
                >
                  {isSaving ? "Salvando…" : "Salvar entidade"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
