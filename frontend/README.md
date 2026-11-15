# KasaSpeech AI Studio frontend

The Next.js workspace includes the Phase 1 dashboard and Phase 2 Speech Studio.
The Speech Studio records microphone audio in the browser, displays a live
microphone waveform, previews supported audio files, and provides playback and
download controls. It does not upload audio or provide ASR, translation, TTS,
or backend integration yet.

## Run locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).
Open `/studio` or choose **Speech Studio** to record or review audio. Microphone
access requires browser permission and a secure context (HTTPS or localhost).
Recordings and selected files remain in the page and are not saved to a server.

Audio file support: WAV, MP3, M4A, FLAC, OGG, and WebM, up to 50 MB. Actual
playback support depends on the browser and codec.

## Validate

```bash
npm run lint
npm run build
```

`NEXT_PUBLIC_API_BASE_URL` in `.env.example` is a placeholder for a future
backend URL; this Phase 1 app does not call it. Never place `HF_TOKEN` in the
frontend. Hugging Face credentials belong only in the backend environment.
