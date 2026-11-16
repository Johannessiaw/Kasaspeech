# LINGUA AI · KasaSpeech

LINGUA AI is the Next.js workspace for KasaSpeech speech recognition, with
separate translation, text-to-speech, language-detection, and assistant
integrations. The original Python/Gradio KasaSpeech Studio and its model
adapters remain in `kasaspeech_independent/`; the speech-recognition model and
training/audit files are preserved.

## Project folders

- `frontend/` — Next.js App Router dashboard, KasaSpeech transcription proxy,
  language workspaces, and provider adapters.
- `kasaspeech_independent/` — existing Gradio application, local KasaSpeech
  model, and Hugging Face ASR/translation/TTS service adapters.
- `audits/` — transcript-normalization and training/audit scripts.

## Run the Next.js app

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app works without
optional providers: KasaSpeech transcription uses the existing public
`JOHANNES02/kasaspeech` Gradio Space; translation, TTS, language detection, and
the assistant show an unconfigured state until configured. Transcription
results and their original audio are saved only in the current browser's
IndexedDB.

## Server-side provider configuration

Set values in `frontend/.env.local` for local work, or as server-side deployment
secrets. Never use `NEXT_PUBLIC_` for credentials. Restart Next.js after
changing environment values.

| Variables | Purpose |
|---|---|
| `LINGUA_TRANSLATION_API_URL`, `LINGUA_TRANSLATION_MODEL` | Translation provider. Defaults to OpenAI-compatible chat-completions; set `LINGUA_TRANSLATION_FORMAT=rest` for the JSON adapter. |
| `LINGUA_TRANSLATION_API_KEY` | Optional bearer token for the selected translation provider. |
| `LINGUA_ASSISTANT_API_URL`, `LINGUA_ASSISTANT_MODEL`, `LINGUA_ASSISTANT_API_KEY` | Independent assistant provider and optional bearer token. |
| `LINGUA_TTS_API_URL`, `LINGUA_TTS_MODEL`, `LINGUA_TTS_API_KEY` | Independent speech provider returning `audio/*`; optional bearer token. |
| `LINGUA_DETECTION_API_URL`, `LINGUA_DETECTION_API_KEY` | Optional language detector. It receives multipart audio and must return JSON with a language code and optional `confidence` from 0 to 1. |
| `KASASPEECH_TRANSLATION_ENDPOINT_URL`, `KASASPEECH_TTS_EN_ENDPOINT_URL`, `KASASPEECH_TTS_TW_ENDPOINT_URL`, `HF_TOKEN` | Existing Hugging Face Inference Endpoints in `kasaspeech_independent/`. The Next.js app can use the existing translation endpoint for English↔Twi and the English/Twi speech endpoints when no `LINGUA_*` endpoint overrides them. |
| `KASASPEECH_ASR_ENDPOINT_URL`, `HF_TOKEN` | Existing Python Gradio hosted-ASR configuration. The Next.js ASR route currently uses the KasaSpeech Gradio Space directly and does not read this endpoint variable. |

Open **API Integrations** in the app for live configuration status and
provider-specific POST tests. Text-provider tests make a real model request;
TTS tests generate and discard a short audio response and may incur provider
charges. OpenAI-compatible endpoints must be complete task URLs. The REST
translation/assistant payload is `{ task, model, text, sourceLanguage,
targetLanguage, voice }`; configure the dot-separated response field in
`.env.local` when the result is not at `text`.

The existing KasaSpeech translation endpoint supports **English↔Twi only**.
Its TTS endpoints support **English** and **Twi** only. The language catalogue
is broader, but the application does not claim that a connected provider
supports every listed language. The optional detection adapter expects
`{ "language": "en", "confidence": 0.9 }` (or `language_code` /
`detected_language`); low or missing confidence requires user confirmation.
Live Translate is batch-based: it records/uploads a clip, optionally detects
language, transcribes through KasaSpeech, and then translates. It is not a
streaming conversation service.

## Existing Python/Gradio KasaSpeech Studio

The Python application remains available independently:

```bash
python -m pip install -r kasaspeech_independent/requirements.txt
python -m kasaspeech_independent.app
```

Open port `7860`. Local ASR loads the fine-tuned KasaSpeech checkpoint; the
optional Hugging Face endpoints provide ASR, English↔Twi translation, and
English/Twi TTS. See
[kasaspeech_independent/README.md](./kasaspeech_independent/README.md) for
endpoint setup, costs, and dataset-sharing details.

## Privacy and deployment limitations

The frontend does not return provider secrets to the browser. Audio is sent
only when transcription/detection is requested; text is sent only when a
language task is submitted. The browser-local transcription history can be
removed in Settings or cleared with browser site data.

This repository does **not** contain user authentication, a tenant model,
persistent server-side provider configuration, or encrypted per-user secret
storage. API credentials are deployment environment variables, not user-editable
API records. Do not expose a credentialed deployment publicly until
authentication, authorization, tenant-isolated secret storage, quotas, and
operational monitoring are added. Use only provider/model licenses that permit
your intended use; the existing NLLB and MMS candidates are non-commercial
licensed.

## Verify

```bash
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

```bash
python -m unittest discover -s kasaspeech_independent/tests -v
python -m pytest audits/test_normalization_v3.py
```
