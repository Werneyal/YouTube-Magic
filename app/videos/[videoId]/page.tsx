"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
