# KasaSpeech AI Studio frontend

The Next.js workspace includes the dashboard, Speech Studio, and hosted-ASR
transcription history.
The Speech Studio records microphone audio in the browser, displays a live
microphone waveform, previews supported audio files, and provides playback and
download controls. Selecting **Transcribe audio** sends the selected clip to
the configured Hugging Face Inference Endpoint through a server-side route.
Actual output and the audio are saved in this browser's IndexedDB history at
`/asr`; nothing is stored in a KasaSpeech server database.

## Run locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).
Open `/studio` to record or review audio, then use **Transcribe audio**. Open
`/asr` to review transcripts and audio saved in this browser. Microphone access
requires browser permission and a secure context (HTTPS or localhost).

Audio file support: WAV, MP3, M4A, FLAC, OGG, and WebM, up to 50 MB. Actual
playback support depends on the browser and codec.

## Configure hosted ASR

The transcription route runs on the same Next.js server on port 3000. It needs
both `KASASPEECH_ASR_ENDPOINT_URL` (an HTTPS Hugging Face Inference Endpoint URL)
and `HF_TOKEN` configured as server-side Codespaces secrets. Restart the app
after adding secrets. The token is never sent to browser code. No endpoint is
currently configured in this workspace; endpoint deployment may incur costs.

Audio is sent to the configured endpoint only after the user selects
**Transcribe audio**. Successful audio and transcript history stays in the
browser and can be removed item-by-item from `/asr`. Clearing browser site data
also clears this history.

## Validate

```bash
npm run lint
npx tsc --noEmit
npm run build
```

`HF_TOKEN` must never be exposed in a `NEXT_PUBLIC_` variable.
