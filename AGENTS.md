# Repository Guidelines

## Project Structure & Module Organization

- `app/` contains the Next.js-style application. `page.tsx` renders the Portuguese UI, `layout.tsx` defines metadata, and `globals.css` holds shared responsive styles.
- `app/api/video/route.ts` exposes `POST /api/video` and keeps authenticated YouTube requests on the server.
- `lib/` contains reusable domain code: URL parsing and YouTube API access in `youtube.ts`, caption retrieval in `transcript.ts`, and shared response types in `video-types.ts`.
- `tests/rendered-html.test.mjs` covers parsing, service errors, transcript fallback, and server rendering.
- `public/` stores static assets such as `og.png`. Hosting configuration lives in `.openai/hosting.json`.

## Build, Test, and Development Commands

Use Node.js 22.13 or newer.

```bash
npm install       # Install locked dependencies
npm run dev       # Start the local Vinext development server
npm run build     # Produce the Cloudflare-compatible production build
npm test          # Build, then run the complete Node test suite
npm run lint      # Check JavaScript and TypeScript with ESLint
```

Run `npm test` before submitting changes that affect parsing, API behavior, rendering, or transcript handling.

## Coding Style & Naming Conventions

Use TypeScript for application code, two-space indentation, double quotes, semicolons, and trailing commas where supported. Name React components and exported types in `PascalCase`; use `camelCase` for functions, variables, and dependency adapters. Keep route handlers thin and place reusable business logic in `lib/`. Preserve Brazilian Portuguese for user-facing copy and accessible labels.

## Testing Guidelines

Tests use `node:test` with `node:assert/strict`. Add focused cases to `tests/rendered-html.test.mjs`, using descriptive Portuguese names such as `test("rejeita URLs sem um identificador válido", ...)`. Mock network and transcript providers; tests must not consume YouTube quota or require credentials. A transcript failure must never discard valid video metadata.

## Commit & Pull Request Guidelines

The current history uses concise, imperative commit subjects, for example `Build Video em Foco app`. Keep each commit scoped to one coherent change. Pull requests should explain behavior changes, list validation performed, link relevant issues, and include screenshots for visible UI changes. Call out environment or deployment changes explicitly.

## Security & Configuration

Copy `.env.example` to `.env.local` and set `YOUTUBE_API_KEY` locally. Never commit or expose this value in client code, logs, tests, or screenshots. Preserve the existing Sites project ID in `.openai/hosting.json`; do not create a replacement site when deploying updates.
