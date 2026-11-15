# KasaSpeech Studio

A matched Gradio interface for KasaSpeech ASR, English↔Twi translation, English
and Twi text-to-speech, and optional consent-based evaluation data sharing.
The ASR local mode loads the fine-tuned checkpoint from
[`JOHANNES02/KASASPEECH/train/run1/ckpt`](https://huggingface.co/JOHANNES02/KASASPEECH/tree/main/train/run1/ckpt),
not the base model weights at the repository root.

## Run in Codespaces

From the repository root:

```bash
python -m pip install -r kasaspeech_independent/requirements.txt
python -m kasaspeech_independent.app
```

Open port `7860` in the Codespaces Ports panel. The app does not create a public
Gradio share link. On the **Speech recognition** tab, record or upload a clip,
inspect the displayed waveform, play it back, and only then click **Transcribe
reviewed audio**.

The local ASR checkpoint is about 2.42 GB and is cached by Hugging Face after
the first local transcription. The current Codespace has already cached it.

## Hosted Hugging Face endpoints

This project and the candidate translation/TTS model cards do not currently
have Hugging Face serverless inference-provider mappings. Hosted mode therefore
requires dedicated Inference Endpoints. Endpoint deployment may incur charges.
Configure these values in Codespaces **Secrets** or **Variables**, then restart
the app:

| Environment variable | Endpoint task/model |
|---|---|
| `HF_TOKEN` | Hugging Face token; inference permission, plus write access for dataset contributions |
| `KASASPEECH_ASR_ENDPOINT_URL` | ASR endpoint serving the fine-tuned `train/run1/ckpt` checkpoint |
| `KASASPEECH_TRANSLATION_ENDPOINT_URL` | Translation endpoint for [`facebook/nllb-200-distilled-600M`](https://huggingface.co/facebook/nllb-200-distilled-600M) |
| `KASASPEECH_TTS_EN_ENDPOINT_URL` | English TTS endpoint for [`facebook/mms-tts-eng`](https://huggingface.co/facebook/mms-tts-eng) |
| `KASASPEECH_TTS_TW_ENDPOINT_URL` | Twi/Akan TTS endpoint for [`Lhue-Lhue/akan-tts-mms-vits`](https://huggingface.co/Lhue-Lhue/akan-tts-mms-vits) |
| `HF_DATASET_REPO_ID` | Optional public dataset repo ID; defaults to `JOHANNES02/KASASPEECH-EVAL` |

The ASR checkpoint is stored in a subfolder, so an endpoint deployed from the
repository root alone would serve the base model, not the fine-tuned model.
Deploy or package the `train/run1/ckpt` weights so the endpoint exposes the
standard Hugging Face automatic-speech-recognition task. The local ASR option
works while the hosted endpoint is being prepared. Translation supports explicit
English→Twi or Twi→English direction; it does not automatically identify
language in code-switched text.

The referenced NLLB and MMS English/Akan-Twi checkpoints use **CC-BY-NC-4.0**.
They are for non-commercial use only. Check each model card and your endpoint
terms before deployment. The app sends audio/text only when you choose a hosted
endpoint; review the endpoint's data-retention policy.

## Optional public evaluation data

The **Optional: share a clip** section is separate from ASR. It uploads nothing
unless a contributor checks the consent box and presses the publish button.
The first opted-in upload creates the public dataset repo if needed. By default
that repo is `JOHANNES02/KASASPEECH-EVAL`; it can be changed with
`HF_DATASET_REPO_ID`.

Each contribution contains a 16 kHz mono WAV, transcript, and selected language
only—no names, contacts, or demographics. The consent checkbox asks the
contributor to confirm they are the speaker or have permission to publish the
clip and transcript under **CC BY 4.0**. Do not upload sensitive audio or
personal information. Public files can be copied and cannot be recalled from
other people's copies. The app uses `HF_TOKEN` from the environment; never put
the token in source code or chat. Each sample can be retrieved by its ID from
the dataset repository:

```python
import json
from huggingface_hub import hf_hub_download

repo = "JOHANNES02/KASASPEECH-EVAL"
example_id = "<id from the contribution link>"
audio = hf_hub_download(repo, f"examples/{example_id}/audio.wav", repo_type="dataset")
metadata_path = hf_hub_download(
    repo, f"examples/{example_id}/metadata.json", repo_type="dataset"
)
with open(metadata_path, encoding="utf-8") as file:
    metadata = json.load(file)
print(metadata["transcript"])
```

## Implementation notes

- Audio capture and upload have separate controls. A waveform and playable
  preview appear before transcription; audio is downmixed and resampled to
  16 kHz for ASR.
- The hosted ASR mode calls `KASASPEECH_ASR_ENDPOINT_URL`. Local mode runs the
  fine-tuned checkpoint in this Codespace.
- Translation and TTS use separately configured hosted endpoints. Their
  results are editable/playable in the same interface.
- `tests/` contains offline tests for audio conversion, model-call routing,
  translation parameters, and the per-clip upload consent gate.
