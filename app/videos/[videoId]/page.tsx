"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { adaptationModels, type AdaptationModelId } from "../../../lib/adaptation-models";
import type {
  AdaptedDocument,
  AdaptedDocumentSummary,
} from "../../../lib/adapted-documents";
import { MarkdownDocument } from "../../../components/markdown-document";
import { createObsidianMarkdownExport } from "../../../lib/document-export";
import { VideoCard } from "../../../components/video-card";
import type { VideoCardData } from "../../../lib/video-types";

type SavedVideo = VideoCardData & {
  savedAt: string;
};

type LoadStatus = "loading" | "not-found" | "error" | "ready";
type AdaptationMode = "standard" | "light" | "tutorial" | "custom";

type DocumentHistoryPayload = {
  documents: AdaptedDocumentSummary[];
  latestDocument: AdaptedDocument | null;
};

function formatDocumentDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function VideoPage() {
  const params = useParams<{ videoId: string }>();
  const [video, setVideo] = useState<SavedVideo | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [model, setModel] = useState<AdaptationModelId>(
    adaptationModels[0].id,
  );
  const [document, setDocument] = useState<AdaptedDocument | null>(null);
  const [documents, setDocuments] = useState<AdaptedDocumentSummary[]>([]);
  const [pendingDocument, setPendingDocument] = useState<{
    model: string;
    content: string;
    prompt: string;
  } | null>(null);
  const [adaptationError, setAdaptationError] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [activeAdaptationMode, setActiveAdaptationMode] =
    useState<AdaptationMode | null>(null);
  const isAdapting = activeAdaptationMode !== null;
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [editorContent, setEditorContent] = useState<string | null>(null);
  const [isUpdatingDocument, setIsUpdatingDocument] = useState(false);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [copiedDocumentKey, setCopiedDocumentKey] = useState("");
  const [isDocumentCollapsed, setIsDocumentCollapsed] = useState(false);
  const isDocumentActionPending =
    isSavingDocument || isUpdatingDocument || isDeletingDocument;

  useEffect(() => {
    let isCurrent = true;

    async function loadVideo() {
      try {
        const response = await fetch("/api/collection", {
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) throw new Error();

        const found = (payload.videos as SavedVideo[]).find(
          (item) => item.videoId === params.videoId,
        );
        if (!isCurrent) return;

        setVideo(found ?? null);
        setStatus(found ? "ready" : "not-found");
        if (!found) return;

        setIsLoadingDocuments(true);
        try {
          const documentResponse = await fetch(
            `/api/collection/${found.videoId}/documents`,
            { cache: "no-store" },
          );
          const documentPayload =
            (await documentResponse.json()) as DocumentHistoryPayload;
          if (!documentResponse.ok) throw new Error();
          if (!isCurrent) return;
          setDocuments(documentPayload.documents);
          setDocument(documentPayload.latestDocument);
        } catch {
          if (isCurrent) {
            setAdaptationError(
              "Não foi possível carregar os documentos salvos deste vídeo.",
            );
          }
        } finally {
          if (isCurrent) setIsLoadingDocuments(false);
        }
      } catch {
        if (isCurrent) setStatus("error");
      }
    }

    void loadVideo();
    return () => {
      isCurrent = false;
    };
  }, [params.videoId]);

  async function saveDocument(
    videoId: string,
    candidate: { model: string; content: string; prompt: string },
  ) {
    setIsSavingDocument(true);
    try {
      const response = await fetch(`/api/collection/${videoId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(candidate),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? "Não foi possível salvar o documento.",
        );
      }

      const savedDocument = payload.document as AdaptedDocument;
      setDocument(savedDocument);
      setDocuments((current) => [
        {
          id: savedDocument.id,
          model: savedDocument.model,
          createdAt: savedDocument.createdAt,
        },
        ...current,
      ]);
      setPendingDocument(null);
    } catch (error) {
      setAdaptationError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o documento.",
      );
      throw error;
    } finally {
      setIsSavingDocument(false);
    }
  }

  async function loadDocument(documentId: string) {
    if (!video) return;

    setAdaptationError("");
    setIsLoadingDocuments(true);
    try {
      const response = await fetch(
        `/api/collection/${video.videoId}/documents/${documentId}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? "Não foi possível carregar o documento.",
        );
      }
      setDocument(payload.document as AdaptedDocument);
      setPendingDocument(null);
      setIsDocumentCollapsed(false);
    } catch (error) {
      setAdaptationError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o documento.",
      );
    } finally {
      setIsLoadingDocuments(false);
    }
  }

  async function copyFinalText(format: "plain" | "obsidian") {
    if (!document || !video) return;

    setAdaptationError("");
    const content =
      format === "obsidian"
        ? createObsidianMarkdownExport(video, document.content)
        : document.content;
    try {
      if (navigator.clipboard?.writeText && globalThis.isSecureContext) {
        await navigator.clipboard.writeText(content);
      } else {
        const field = globalThis.document.createElement("textarea");
        field.value = content;
        field.style.position = "fixed";
        field.style.opacity = "0";
        globalThis.document.body.append(field);
        field.select();
        const didCopy = globalThis.document.execCommand("copy");
        field.remove();
        if (!didCopy) throw new Error();
      }

      const key = `${document.id}:${format}`;
      setCopiedDocumentKey(key);
      window.setTimeout(() => setCopiedDocumentKey(""), 2_000);
    } catch {
      setAdaptationError("Não foi possível copiar o texto do documento.");
    }
  }
  async function updateDocument() {
    if (!video || !document?.id || editorContent === null) return;

    setAdaptationError("");
    setIsUpdatingDocument(true);
    try {
      const response = await fetch(
        `/api/collection/${video.videoId}/documents/${document.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editorContent }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? "Não foi possível salvar as alterações.",
        );
      }

      setDocument(payload.document as AdaptedDocument);
      setEditorContent(null);
    } catch (error) {
      setAdaptationError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as alterações.",
      );
    } finally {
      setIsUpdatingDocument(false);
    }
  }

  async function deleteDocument() {
    if (!video || !document?.id) return;
    if (!globalThis.confirm("Excluir permanentemente esta versão do documento?")) {
      return;
    }

    setAdaptationError("");
    setIsDeletingDocument(true);
    try {
      const response = await fetch(
        `/api/collection/${video.videoId}/documents/${document.id}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as DocumentHistoryPayload & {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "Não foi possível excluir o documento.",
        );
      }

      setDocuments(payload.documents);
      setDocument(payload.latestDocument);
      setEditorContent(null);
      setIsDocumentCollapsed(false);
      setCopiedDocumentKey("");
    } catch (error) {
      setAdaptationError(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o documento.",
      );
    } finally {
      setIsDeletingDocument(false);
    }
  }
  async function adaptTranscript(mode: AdaptationMode) {
    if (!video || video.transcript.status !== "available" || isAdapting) return;

    const submittedCustomPrompt = customPrompt.trim();
    if (mode === "custom" && !submittedCustomPrompt) {
      setAdaptationError("Informe o prompt personalizado antes de executar.");
      return;
    }

    setAdaptationError("");
    setDocument(null);
    setPendingDocument(null);
    setIsDocumentCollapsed(false);
    setActiveAdaptationMode(mode);

    try {
      const response = await fetch("/api/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: video.title,
          transcript: video.transcript.text,
          model,
          mode,
          ...(mode === "custom" ? { customPrompt: submittedCustomPrompt } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? "Não foi possível adaptar a transcrição.",
        );
      }
      if (typeof payload.prompt !== "string" || !payload.prompt.trim()) {
        throw new Error("Não foi possível registrar o prompt utilizado.");
      }

      const candidate = {
        model:
          mode === "light"
            ? `${model} · Adaptar Light`
            : mode === "tutorial"
              ? `${model} · Tutorial`
              : mode === "custom"
                ? `${model} · Personalizado`
                : model,
        content: payload.document as string,
        prompt: payload.prompt,
      };
      setDocument({
        id: "",
        model: candidate.model,
        content: candidate.content,
        prompt: candidate.prompt,
        createdAt: new Date().toISOString(),
      });
      setPendingDocument(candidate);
      await saveDocument(video.videoId, candidate);
    } catch (error) {
      setAdaptationError(
        error instanceof Error
          ? error.message
          : "Não foi possível adaptar a transcrição.",
      );
    } finally {
      setActiveAdaptationMode(null);
    }
  }
  return (
    <main className="video-detail-page">
      <div className="background-grid" aria-hidden="true" />

      <header className="site-header">
        <a className="brand" href="/" aria-label="Vídeo em Foco — início">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>Vídeo em Foco</span>
        </a>
        <nav className="site-nav" aria-label="Navegação principal">
          <a className="active" href="/" aria-current="page">
            Vídeos
          </a>
          <a href="/knowledge-base">Base de Conhecimento</a>
        </nav>
      </header>

      <section className="video-detail-header">
        <a className="back-link" href="/">
          <span aria-hidden="true">←</span>
          Voltar para a coleção
        </a>
        <div>
          <span>Vídeo selecionado</span>
          <h1>Espaço de análise do vídeo</h1>
          <p>
            Este é o ponto de partida para aprofundar a análise, revisar a
            transcrição e adicionar novas funcionalidades a este vídeo.
          </p>
          {video && (
            <a
              className="detail-action youtube-video-action"
              href={`https://www.youtube.com/watch?v=${video.videoId}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir vídeo no YouTube
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      </section>

      <section className="video-detail-content" aria-live="polite">
        {status === "loading" && (
          <div className="video-detail-state">Carregando o vídeo…</div>
        )}
        {status === "not-found" && (
          <div className="video-detail-state">
            <strong>Este vídeo não está disponível na sua coleção.</strong>
            <p>Volte à página inicial e selecione um vídeo salvo.</p>
            <a className="detail-action" href="/">
              Ir para a coleção
            </a>
          </div>
        )}
        {status === "error" && (
          <div className="video-detail-state">
            <strong>Não foi possível carregar este vídeo agora.</strong>
            <p>Tente novamente ou volte à sua coleção.</p>
            <a className="detail-action" href="/">
              Voltar para a coleção
            </a>
          </div>
        )}
        {status === "ready" && video && (
          <>
            <VideoCard video={video} />
            <section className="adaptation-panel" aria-labelledby="adaptation-title">
              <div>
                <span>Documento técnico</span>
                <h2 id="adaptation-title">Adaptar transcrição</h2>
                <p>
                  Organize a transcrição em um documento técnico completo,
                  preservando o conteúdo relevante do vídeo. Escolha Adaptar Light para usar o prompt técnico alternativo ou Criar Tutorial para estruturar um passo a passo reproduzível.
                </p>
              </div>
              <div className="adaptation-controls">
                <label>
                  <span>Modelo do OpenRouter</span>
                  <select
                    value={model}
                    onChange={(event) =>
                      setModel(event.target.value as AdaptationModelId)
                    }
                    disabled={isAdapting || isDocumentActionPending || editorContent !== null}
                  >
                    {adaptationModels.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label} — {option.description}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="adapt-button-row">
                  <button
                    className="adapt-button"
                    type="button"
                    onClick={() => void adaptTranscript("standard")}
                    disabled={
                      isAdapting || isDocumentActionPending || editorContent !== null || video.transcript.status !== "available"
                    }
                  >
                    {activeAdaptationMode === "standard" ? "Adaptando…" : "Adaptar"}
                    {activeAdaptationMode !== "standard" && <span aria-hidden="true">↗</span>}
                  </button>
                  <button
                    className="adapt-button adapt-button-light"
                    type="button"
                    onClick={() => void adaptTranscript("light")}
                    disabled={
                      isAdapting || isDocumentActionPending || editorContent !== null || video.transcript.status !== "available"
                    }
                  >
                    {activeAdaptationMode === "light" ? "Adaptando…" : "Adaptar Light"}
                    {activeAdaptationMode !== "light" && <span aria-hidden="true">↗</span>}
                  </button>
                  <button
                    className="adapt-button adapt-button-tutorial"
                    type="button"
                    onClick={() => void adaptTranscript("tutorial")}
                    disabled={
                      isAdapting || isDocumentActionPending || editorContent !== null || video.transcript.status !== "available"
                    }
                  >
                    {activeAdaptationMode === "tutorial"
                      ? "Criando…"
                      : "Criar Tutorial"}
                    {activeAdaptationMode !== "tutorial" && (
                      <span aria-hidden="true">↗</span>
                    )}
                  </button>
                </div>
              </div>
              {video.transcript.status !== "available" && (
                <p className="adaptation-note">
                  A adaptação requer uma transcrição disponível.
                </p>
              )}
            </section>
            <section className="custom-adaptation-panel" aria-labelledby="custom-prompt-title">
              <div>
                <span>Instrução própria</span>
                <h2 id="custom-prompt-title">Prompt personalizado</h2>
                <p>
                  Descreva o resultado que você quer gerar a partir da transcrição.
                  O prompt será salvo junto da versão criada.
                </p>
              </div>
              <label>
                <span>Seu prompt</span>
                <textarea
                  value={customPrompt}
                  onChange={(event) => setCustomPrompt(event.target.value)}
                  placeholder="Ex.: Extraia decisões, responsáveis e próximos passos em Markdown."
                  disabled={
                    isAdapting || isDocumentActionPending || editorContent !== null
                  }
                />
              </label>
              <button
                className="adapt-button adapt-button-custom"
                type="button"
                onClick={() => void adaptTranscript("custom")}
                disabled={
                  isAdapting ||
                  isDocumentActionPending ||
                  editorContent !== null ||
                  !customPrompt.trim() ||
                  video.transcript.status !== "available"
                }
              >
                {activeAdaptationMode === "custom"
                  ? "Executando…"
                  : "Executar prompt"}
                {activeAdaptationMode !== "custom" && (
                  <span aria-hidden="true">↗</span>
                )}
              </button>
            </section>            <div className="adaptation-status" aria-live="polite">
              {adaptationError && <p>{adaptationError}</p>}
              {isAdapting && (
                <p>
                  {activeAdaptationMode === "tutorial"
                    ? "O modelo está estruturando o tutorial…"
                    : activeAdaptationMode === "custom"
                      ? "O modelo está executando o prompt personalizado…"
                      : "O modelo está estruturando o documento técnico…"}
                </p>
              )}
              {isSavingDocument && <p>Salvando uma nova versão…</p>}
            </div>
            <section className="document-history" aria-labelledby="document-history-title">
              <div>
                <span>Histórico persistente</span>
                <h2 id="document-history-title">Documentos salvos</h2>
              </div>
              {isLoadingDocuments ? (
                <p>Carregando versões…</p>
              ) : documents.length ? (
                <div className="document-history-list">
                  {documents.map((savedDocument) => (
                    <button
                      key={savedDocument.id}
                      className={
                        document?.id === savedDocument.id ? "active" : ""
                      }
                      type="button"
                      onClick={() => void loadDocument(savedDocument.id)}
                      disabled={isAdapting || isDocumentActionPending || editorContent !== null}
                    >
                      <strong>{savedDocument.model}</strong>
                      <small>{formatDocumentDate(savedDocument.createdAt)}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p>Nenhuma adaptação foi salva para este vídeo.</p>
              )}
            </section>
            {document && (
              <section className="adapted-document" aria-labelledby="document-title">
                <div className="adapted-document-heading">
                  <span>Resultado da adaptação</span>
                  <h2 id="document-title">Documento técnico</h2>
                  <p>
                    {document.id
                      ? `Salvo em ${formatDocumentDate(document.createdAt)} com ${document.model}.`
                      : "Documento gerado; aguardando salvamento."}
                  </p>
                </div>
                <div className="document-actions" aria-label="Ações do documento">
                  <button
                    className="document-action"
                    type="button"
                    onClick={() => void copyFinalText("obsidian")}
                    disabled={isDocumentActionPending || editorContent !== null}
                  >
                    {copiedDocumentKey === `${document.id}:obsidian`
                      ? "Copiado!"
                      : "Copiar para Obsidian"}
                  </button>
                  <button
                    className="document-action document-action-secondary"
                    type="button"
                    onClick={() => void copyFinalText("plain")}
                    disabled={isDocumentActionPending || editorContent !== null}
                  >
                    {copiedDocumentKey === `${document.id}:plain`
                      ? "Copiado!"
                      : "Copiar só o texto"}
                  </button>
                  <button
                    className="document-action document-action-secondary"
                    type="button"
                    onClick={() => setIsDocumentCollapsed((current) => !current)}
                    disabled={isDocumentActionPending || editorContent !== null}
                  >
                    {isDocumentCollapsed
                      ? "Expandir documento"
                      : "Colapsar documento"}
                  </button>                  {document.id && editorContent === null && (
                    <button
                      className="document-action"
                      type="button"
                      onClick={() => {
                        setAdaptationError("");
                        setIsDocumentCollapsed(false);
                        setEditorContent(document.content);
                      }}
                      disabled={isDocumentActionPending}
                    >
                      Editar texto
                    </button>
                  )}
                  {document.id && (
                    <button
                      className="document-action document-action-delete"
                      type="button"
                      onClick={() => void deleteDocument()}
                      disabled={isDocumentActionPending}
                    >
                      {isDeletingDocument ? "Excluindo…" : "Excluir"}
                    </button>
                  )}
                </div>
                {!isDocumentCollapsed && (
                  <>                <section className="adaptation-prompt" aria-labelledby="prompt-title">
                  <h3 id="prompt-title">Prompt utilizado</h3>
                  {document.prompt ? (
                    <>
                      <p>
                        Estas instruções foram enviadas ao modelo. O título e a
                        transcrição do vídeo foram enviados separadamente como
                        material-fonte.
                      </p>
                      <pre>{document.prompt}</pre>
                    </>
                  ) : (
                    <p>
                      O prompt não foi registrado para esta versão anterior do
                      documento.
                    </p>
                  )}
                </section>


                {editorContent !== null ? (
                  <div className="document-editor">
                    <label htmlFor="document-content">Editar texto final</label>
                    <textarea
                      id="document-content"
                      value={editorContent}
                      onChange={(event) => setEditorContent(event.target.value)}
                      disabled={isUpdatingDocument}
                    />
                    <div>
                      <button
                        className="document-action"
                        type="button"
                        onClick={() => void updateDocument()}
                        disabled={isUpdatingDocument}
                      >
                        {isUpdatingDocument ? "Salvando…" : "Salvar alterações"}
                      </button>
                      <button
                        className="document-action document-action-secondary"
                        type="button"
                        onClick={() => setEditorContent(null)}
                        disabled={isUpdatingDocument}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <MarkdownDocument content={document.content} />
                )}
                {pendingDocument && (
                  <button
                    className="retry-save-button"
                    type="button"
                    onClick={() =>
                      video && void saveDocument(video.videoId, pendingDocument)
                    }
                    disabled={isSavingDocument}
                  >
                    {isSavingDocument ? "Salvando…" : "Tentar salvar novamente"}
                  </button>
                )}                  </>
                )}
              </section>
            )}
            <section className="video-detail-next" aria-label="Próximas análises">
              <span>Em evolução</span>
              <h2>Novas análises serão reunidas aqui</h2>
              <p>
                A descrição e a transcrição acima permanecem como referência
                para as próximas ferramentas de estudo deste vídeo.
              </p>
            </section>
          </>
        )}
      </section>

      <footer>
        <span>Vídeo em Foco</span>
        <p>Seu espaço individual para entender cada vídeo.</p>
      </footer>
    </main>
  );
}
















