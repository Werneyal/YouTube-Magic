import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
  const description =
    "Analise metadados e transcrição de um vídeo do YouTube em um único card.";

  return {
    title: "Vídeo em Foco — análise e transcrição do YouTube",
    description,
    openGraph: {
      title: "Vídeo em Foco",
      description,
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1792, height: 925 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Vídeo em Foco",
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
