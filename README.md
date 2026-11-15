# KasaSpeech

KasaSpeech is an independent Ghanaian English–Twi speech-recognition project with a browser-based studio for recording or uploading audio, reviewing model output, and keeping transcription history locally; hosted inference is optional and uses a server-side Hugging Face Inference Endpoint proxy.

## Project folders

- `frontend/` — Next.js AI Studio, microphone and upload workspace, hosted-ASR proxy, and browser-local transcription history.
- `audits/` — training and transcript-normalization scripts, plus focused normalization tests.
- `kasaspeech_independent/` — separate Gradio prototype, Hugging Face service adapters, and Python tests.

## Run locally

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set the two server-side environment variables in `frontend/.env.local` to enable hosted transcription:

- `KASASPEECH_ASR_ENDPOINT_URL` — the HTTPS URL of the Hugging Face Inference Endpoint.
- `HF_TOKEN` — a Hugging Face token authorized to call that endpoint.

Keep `.env.local` private and untracked. The app can run without these values, but hosted transcription will remain unavailable.

## Run in Codespaces

Add `KASASPEECH_ASR_ENDPOINT_URL` and `HF_TOKEN` as Codespaces secrets, then restart the frontend process. Open the forwarded port **3000**. Keep the port private; the token is read only by the server and must never be exposed through a `NEXT_PUBLIC_` variable.

## Verify

```bash
cd frontend
npm ci
npm run lint
npm run build
```

Run the Gradio prototype tests after installing its dependencies:

```bash
python -m pip install -r kasaspeech_independent/requirements.txt
python -m unittest discover -s kasaspeech_independent/tests -v
```

Run the focused audit-script test with pytest:

```bash
python -m pip install pytest
python -m pytest audits/test_normalization_v3.py
```

## Privacy and transcription history

Audio stays in the browser until **Transcribe audio** is selected; only then is the selected clip sent to the configured Hugging Face endpoint. Successful audio and transcript results are stored in IndexedDB in that browser, not in a KasaSpeech database. `/asr` lists and plays those completed local-history items; clearing browser site data removes them. Translation and TTS are not connected in the Next.js frontend.
