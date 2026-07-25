"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { adaptationModels, type AdaptationModelId } from "../../../lib/adaptation-models";
import type {
  AdaptedDocument,
  AdaptedDocumentSummary,
} from "../../../lib/adapted-documents";
import { MarkdownDocument } from "../../../components/markdown-document";
import { VideoCard } from "../../../components/video-card";
import type { VideoCardData } from "../../../lib/video-types";

type SavedVideo = VideoCardData & {
  savedAt: string;
};

type LoadStatus = "loading" | "not-found" | "error" | "ready";

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
  } | null>(null);
  const [adaptationError, setAdaptationError] = useState("");
  const [isAdapting, setIsAdapting] = useState(false);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

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
    candidate: { model: string; content: string },
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

  async function adaptTranscript() {
    if (!video || video.transcript.status !== "available") return;

    setAdaptationError("");
    setDocument(null);
    setPendingDocument(null);
    setIsAdapting(true);

    try {
      const response = await fetch("/api/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: video.title,
          transcript: video.transcript.text,
          model,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? "Não foi possível adaptar a transcrição.",
        );
      }
      const candidate = { model, content: payload.document as string };
      setDocument({
        id: "",
        model: candidate.model,
        content: candidate.content,
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
      setIsAdapting(false);
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
                  preservando o conteúdo relevante do vídeo.
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
                    disabled={isAdapting}
                  >
                    {adaptationModels.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label} — {option.description}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="adapt-button"
                  type="button"
                  onClick={() => void adaptTranscript()}
                  disabled={
                    isAdapting || video.transcript.status !== "available"
                  }
                >
                  {isAdapting ? "Adaptando…" : "Adaptar"}
                  {!isAdapting && <span aria-hidden="true">↗</span>}
                </button>
              </div>
              {video.transcript.status !== "available" && (
                <p className="adaptation-note">
                  A adaptação requer uma transcrição disponível.
                </p>
              )}
            </section>
            <div className="adaptation-status" aria-live="polite">
              {adaptationError && <p>{adaptationError}</p>}
              {isAdapting && (
                <p>O modelo está estruturando o documento técnico…</p>
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
                      disabled={isAdapting || isSavingDocument}
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
                <MarkdownDocument content={document.content} />
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
