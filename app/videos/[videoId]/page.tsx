"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { adaptationModels, type AdaptationModelId } from "../../../lib/adaptation-models";
import { MarkdownDocument } from "../../../components/markdown-document";
import { VideoCard } from "../../../components/video-card";
import type { VideoCardData } from "../../../lib/video-types";

type SavedVideo = VideoCardData & {
  savedAt: string;
};

type LoadStatus = "loading" | "not-found" | "error" | "ready";

export default function VideoPage() {
  const params = useParams<{ videoId: string }>();
  const [video, setVideo] = useState<SavedVideo | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [model, setModel] = useState<AdaptationModelId>(
    adaptationModels[0].id,
  );
  const [document, setDocument] = useState("");
  const [adaptationError, setAdaptationError] = useState("");
  const [isAdapting, setIsAdapting] = useState(false);

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
      } catch {
        if (isCurrent) setStatus("error");
      }
    }

    void loadVideo();
    return () => {
      isCurrent = false;
    };
  }, [params.videoId]);

  async function adaptTranscript() {
    if (!video || video.transcript.status !== "available") return;

    setAdaptationError("");
    setDocument("");
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
      setDocument(payload.document as string);
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
            </div>
            {document && (
              <section className="adapted-document" aria-labelledby="document-title">
                <div className="adapted-document-heading">
                  <span>Resultado da adaptação</span>
                  <h2 id="document-title">Documento técnico</h2>
                </div>
                <MarkdownDocument content={document} />
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
