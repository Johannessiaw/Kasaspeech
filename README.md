# Kasaspeech
ASR

## KasaSpeech AI Studio frontend

The standalone Next.js app in `frontend/` provides the responsive dashboard and
a browser-local Speech Studio with microphone recording, live waveform,
playback, and audio-file review. Model inference, translation, TTS, and a
backend are not connected yet.

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run `npm run lint` and
`npm run build` from `frontend/` to verify the app.

Open `/studio` to record or review audio. Microphone permission is required.
Audio stays in the browser and is not uploaded or transcribed in this phase.

The existing Gradio prototype and imported source snapshots remain separate
and unchanged. The frontend does not connect to Hugging Face. When a backend is
added, `HF_TOKEN` must remain a server-side Codespaces secret and must never be
added to frontend code or a `NEXT_PUBLIC_` variable.
