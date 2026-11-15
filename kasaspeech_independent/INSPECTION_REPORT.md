# KasaSpeech upstream inspection report

## Scope and provenance

- Upstream: [JOHANNES02/KASASPEECH](https://huggingface.co/JOHANNES02/KASASPEECH)
- Snapshot inspected: `5b9d96f5c06a7af117bc25df300e2bbaafde29c5` (2026-11-15)
- Hugging Face metadata reports the model as public, ungated, and `apache-2.0`.
- The existing workspace contained `README.md` and the three files under `audits/`. Those files were left unchanged. This inspection and its upstream snapshot are in the new `kasaspeech_independent/` directory.
- The test UI loads the later published fine-tuned checkpoint from `train/run1/ckpt` at revision `c9d9b26561193825eeeb02b5173005aae4028e4f`, rather than the base weights at the repository root.

## Retrieved files

The upstream snapshot is in [upstream/](./upstream/). It contains:

- Model card and repository attributes: [`README.md`](./upstream/README.md), [`.gitattributes`](./upstream/.gitattributes)
- Model configuration and preprocessing/tokenizer data: [`config.json`](./upstream/config.json), [`preprocessor_config.json`](./upstream/preprocessor_config.json), [`tokenizer_config.json`](./upstream/tokenizer_config.json), [`special_tokens_map.json`](./upstream/special_tokens_map.json), [`added_tokens.json`](./upstream/added_tokens.json), [`vocab.json`](./upstream/vocab.json)
- Python source: [`normalization_v3.py`](./upstream/audits/normalization_v3.py), [`resume_setup.py`](./upstream/audits/resume_setup.py), [`train_dondo_v1.py`](./upstream/audits/train_dondo_v1.py)

The referenced dataset's documentation card is saved separately at [`references/Ghana_English-Twi_Code-switching_Speech_README.md`](./references/Ghana_English-Twi_Code-switching_Speech_README.md). This is documentation only; no dataset content was retrieved.

The Python files passed a syntax parse check, and the JSON files parsed successfully. They were not executed.

The repository has **no standalone inference script, Gradio app, requirements file, or custom model/processor implementation**. Its inference example is embedded in the model card. That example loads `KhayaAI/w2v-bert-ada_ewe_fat_fra_gaa_nzi_twi_en`, rather than the KasaSpeech repository ID, so it is not a self-contained inference entry point for the KasaSpeech checkpoint.

A separate matched Gradio UI has since been added at [`app.py`](./app.py), with its run instructions in [`README.md`](./README.md). It provides microphone/upload capture, waveform and playback review, ASR, translation, TTS, and a per-recording consent gate for public data contributions. It is not part of the upstream snapshot and does not modify the upstream copies.

## Existing architecture and code

- The config identifies a Transformers `Wav2Vec2BertForCTC` model (`model_type: wav2vec2-bert`) with 24 hidden layers, hidden size 1024, 16 attention heads, and an 87-entry vocabulary.
- The processor config identifies `Wav2Vec2BertProcessor`, a `SeamlessM4TFeatureExtractor`, 80 mel bins, and 16 kHz audio. The tokenizer is `Wav2Vec2CTCTokenizer`.
- `normalization_v3.py` normalizes Unicode/transcripts and retains selected Latin and African-language characters.
- `resume_setup.py` is Kaggle-oriented setup code: it reads a Hugging Face token from Kaggle Secrets, loads the processor and manifest, and defines Hub upload/logging helpers.
- `train_dondo_v1.py` contains a CUDA training/resume loop, evaluation, and checkpoint/log uploads. It expects notebook/global state (`CONFIG`, `REPO`, `HF_TOKEN`, `MODEL`, `processor`, `tok`, `api`, and other helpers); it is not standalone.
- The model card describes multilingual Southern Ghana ASR and gives a language-prefix inference example. Treat its prefix method and results as upstream claims to validate; they are not an independent inference implementation.
- The published `train/run1/ckpt/state.json` reports update 2929, while the accompanying `train/run1/train_log.csv` has entries through update 3000 (including 7.15% validation WER). The latest checkpoint state and log therefore do not identify the same final update; the UI loads the checkpoint as published and does not assume it contains update 3000.
- The UI offers local ASR and a hosted endpoint mode. Hugging Face model metadata reported no inference-provider mapping for the KasaSpeech checkpoint, so hosted ASR requires a separately deployed endpoint that serves the `train/run1/ckpt` subfolder; deploying the repository root alone would serve the base checkpoint.
- The UI's candidate translation model is [`facebook/nllb-200-distilled-600M`](https://huggingface.co/facebook/nllb-200-distilled-600M), which includes `twi_Latn` and `eng_Latn` but is marked `inference: false` and licensed CC-BY-NC-4.0. It needs a dedicated endpoint, is non-commercial, and does not automatically identify code-switch direction.
- Candidate TTS models are [`facebook/mms-tts-eng`](https://huggingface.co/facebook/mms-tts-eng) and [`Lhue-Lhue/akan-tts-mms-vits`](https://huggingface.co/Lhue-Lhue/akan-tts-mms-vits). Both declare CC-BY-NC-4.0; the Twi/Akan fine-tune is described as single-speaker. Neither had an inference-provider mapping when checked.

## External dependencies, endpoints, and authentication

| Dependency | Where/how it is used | Access and implications |
|---|---|---|
| Hugging Face Hub, `JOHANNES02/KASASPEECH` | `hf_hub_download`, `snapshot_download`, `HfApi.upload_file`, and `HfApi.upload_folder` in the setup/training scripts | The repo is public. Read operations can use the Hub; uploads require an authorized token with write access. The scripts expect `HF_TOKEN` to be supplied by Kaggle Secrets; no token is included in the retrieved files. |
| Hugging Face model, [`KhayaAI/w2v-bert-ada_ewe_fat_fra_gaa_nzi_twi_en`](https://huggingface.co/KhayaAI/w2v-bert-ada_ewe_fat_fra_gaa_nzi_twi_en) | `resume_setup.py` loads its `AutoProcessor`; training and the README inference example load its pretrained model | The model is public/ungated and declares Apache-2.0. This is a dependency on Khaya AI's model artifacts via Hugging Face, not a call to a Khaya-hosted inference API. |
| Hugging Face dataset, [`Kennethdot/Ghana_English-Twi_Code-switching_Speech`](https://huggingface.co/datasets/Kennethdot/Ghana_English-Twi_Code-switching_Speech) | `resume_setup.py`'s `load_clean()` calls `datasets.load_dataset(..., token=HF_TOKEN)` | The repo is public/ungated and declares Apache-2.0. No dataset files were downloaded. Its card's sample code names a different repo, `Kennethdot/Ghana_English-Twi_Code_switching_ASR`; that alternate ID returned 401 to an unauthenticated metadata check, so confirm the intended ID before relying on the sample. |
| Kaggle Secrets | `UserSecretsClient().get_secret("HF_TOKEN")` in `resume_setup.py` | Requires a Kaggle execution environment and a configured secret. This is not portable setup for an independently hosted service. |
| Khaya AI/Khaya Studio | The model card links to [khaya.ai](https://khaya.ai), [studio.khaya.ai](https://studio.khaya.ai), and [studio.khaya.ai/asr](https://studio.khaya.ai/asr) | These are product/professional-service links in documentation only. No code in the retrieved repository calls these hosted APIs or includes their credentials, API schema, or terms. |
| Hugging Face Inference Endpoints | `hf_services.py` can call the configured ASR, translation, and TTS endpoints using `InferenceClient` | The endpoint URLs and `HF_TOKEN` must be configured by the account owner. The tested model metadata had no serverless inference-provider mappings, so the hosted features do not work until dedicated endpoints are deployed; provisioning may incur charges. |
| Public opt-in dataset | Optional uploader targets `JOHANNES02/KASASPEECH-EVAL` by default, configurable with `HF_DATASET_REPO_ID` | It creates a separate public dataset on the first opted-in upload and sends only 16 kHz audio plus transcript/language metadata. Each clip needs explicit CC BY 4.0 consent and an `HF_TOKEN` with write access. No clip is uploaded automatically. |
| Demo and paper links | The model card links to the [Ghana-NLP Hugging Face Space](https://huggingface.co/spaces/Ghana-NLP/Southern-Ghana-ASR) and [arXiv paper](https://arxiv.org/abs/2607.21540); it also embeds a Hugging Face-hosted image | Documentation references, not runtime dependencies of the Python scripts. |

The upstream code depends on `transformers`, `huggingface_hub`, `datasets`, `kaggle_secrets`, `pandas`, `numpy`, `torch`, and `jiwer`; the README inference snippet also uses `torchaudio`. The independent UI adds a pinned dependency manifest with `transformers==5.20.2` (the fine-tuned checkpoint config's recorded version), `huggingface_hub`, Gradio, TorchAudio, and SoundFile.

## Licensing and usage notes

- The KasaSpeech model metadata and card declare Apache-2.0; the Khaya AI model and the referenced dataset also declare Apache-2.0 in their Hugging Face metadata/cards.
- The optional contribution dataset is created with a CC BY 4.0 card. Its consent control explicitly requires the speaker/uploader to confirm the right to publish the recording and transcript under that license; public voice recordings can be identifiable and copies cannot be recalled.
- The selected NLLB and MMS English/Akan-Twi checkpoints are CC-BY-NC-4.0, so their outputs/services must not be used commercially unless separate rights are obtained.
- No standalone `LICENSE` file is present in the KasaSpeech repository snapshot. The upstream README requests attribution and contains a DONDO paper citation and acknowledgements; those materials are preserved in the snapshot.
- Retain upstream notices and attribution if reusing the materials, and verify the full license texts and any applicable dataset/model terms before redistribution. The scripts' Hub write operations also require repository authorization; that is separate from the model's license.
- The model card describes a read-religious-text domain and reports in-domain results. Its stated limitations include domain/generalization limits and language steering. It does not provide a complete operational or hosted-API terms document.

## Download scope

The source import did not include model weights, dataset audio, manifests, audit CSV/JSON outputs, or training logs. After explicit approval to validate the app, its first real inference downloaded only the approximately 2.42 GB fine-tuned checkpoint (`train/run1/ckpt/model.safetensors`) into the Hugging Face user cache. It was not copied into the workspace. The root base-model weights and all datasets/audit artifacts remain un-downloaded.

## Files to revisit during redesign

No architecture or inference redesign has been started. When that work is authorized, review the upstream copies of `audits/resume_setup.py` and `audits/train_dondo_v1.py` to remove Kaggle-specific authentication, external model/dataset assumptions, and Hub upload/checkpoint behavior; review `audits/normalization_v3.py` against the intended English–Twi normalization policy; and treat the config/tokenizer files as model-specific rather than assuming they fit a new architecture. The original snapshot should remain preserved under `upstream/`; new implementation files should be created separately.
