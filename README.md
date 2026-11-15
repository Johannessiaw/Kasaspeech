# Kasaspeech
ASR

## KasaSpeech AI Studio frontend

The standalone Next.js app in `frontend/` provides the dashboard, a browser-local
Speech Studio, and a hosted-ASR transcription screen. Transcription runs only
when a user submits audio to a configured Hugging Face Inference Endpoint.

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run `npm run lint` and
`npm run build` from `frontend/` to verify the app.

Open `/studio` to record or review audio and `/asr` to review transcriptions
saved in this browser. The frontend and same-origin ASR proxy use port 3000.
Configure `KASASPEECH_ASR_ENDPOINT_URL` and `HF_TOKEN` as server-side Codespaces
secrets; never expose `HF_TOKEN` to browser code. Audio is sent to the endpoint
only when **Transcribe audio** is selected. Translation and TTS are not
connected yet.

The existing Gradio prototype and imported source snapshots remain separate
and unchanged. The frontend uses a same-origin server-side proxy to call the
configured Hugging Face endpoint. `HF_TOKEN` must remain a server-side
Codespaces secret and must never be added to frontend code or a `NEXT_PUBLIC_`
variable.
