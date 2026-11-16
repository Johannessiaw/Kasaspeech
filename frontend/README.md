# LINGUA AI frontend

The Next.js App Router application provides the dashboard, browser-based
KasaSpeech recording/upload and transcription, local transcription history,
translation, TTS, AI assistant, provider status/tests, and a batch speech-to-
translation workflow. The app preserves the separate Python KasaSpeech Studio.

## Run locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Microphone access requires
browser permission and a secure context (HTTPS or localhost). Audio files may
be WAV, MP3, M4A, FLAC, OGG, or WebM, up to 50 MB.

## Providers

See the root [README](../README.md#server-side-provider-configuration) and
[`.env.example`](./.env.example) for supported environment variables and
payload formats. Keep credentials server-side and restart the app after
changing them. KasaSpeech ASR currently calls the existing
`JOHANNES02/kasaspeech` Gradio Space. Its endpoint returns transcript text only;
it does not return detected language, confidence, timestamps, or speakers.

The Live Translate page is batch-based, not streaming. An optional detector
must be configured to return a language code and confidence; the current
KasaSpeech translation endpoint supports English↔Twi only. No translation or
speech output is fabricated when a provider is missing or fails.

Provider Integrations tests send actual requests to configured services and
may incur provider charges. The current provider setup uses deployment
environment variables; it is not an authenticated user-facing secret manager.
Do not expose a credentialed installation publicly without authentication and
tenant-isolated secret storage.

## Validate

```bash
npm run lint
npx tsc --noEmit
npm run build
```
