# Vídeo em Foco

Web app em português para consultar os metadados e a transcrição pública de um
vídeo do YouTube a partir de sua URL.

## Configuração

1. Crie uma chave no Google Cloud com acesso à YouTube Data API v3.
2. Copie `.env.example` para `.env.local`.
3. Preencha `YOUTUBE_API_KEY` em `.env.local`.

Nunca envie a chave ao navegador nem a inclua no controle de versão.

## Executar

Requer Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

## Validação

```bash
npm test
```

Os metadados são obtidos pela API oficial do YouTube. A transcrição utiliza
legendas públicas por meio de uma integração não oficial e pode ficar
indisponível quando o vídeo não tem legendas ou possui restrições.
