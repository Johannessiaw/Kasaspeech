import io
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

import gradio as gr
import numpy as np
import soundfile as sf
from huggingface_hub import HfApi, InferenceClient

DATASET_REPO_ID = os.environ.get(
    "HF_DATASET_REPO_ID",
    "JOHANNES02/KASASPEECH-EVAL",
)

ENDPOINT_ENV = {
    "asr": "KASASPEECH_ASR_ENDPOINT_URL",
    "translation": "KASASPEECH_TRANSLATION_ENDPOINT_URL",
    "tts_english": "KASASPEECH_TTS_EN_ENDPOINT_URL",
    "tts_twi": "KASASPEECH_TTS_TW_ENDPOINT_URL",
}

DATASET_CARD = """---
license: cc-by-4.0
language:
  - en
  - tw
task_categories:
  - automatic-speech-recognition
---

# KasaSpeech opt-in evaluation clips

This dataset contains audio clips and transcripts shared by contributors who
explicitly confirmed they have the right to publish them under CC BY 4.0.
Examples are stored in `examples/<id>/audio.wav` and `examples/<id>/metadata.json`.
No names, contact details, or demographic details are collected by the app.

Do not upload sensitive recordings. Public files can be copied by others and
cannot be recalled from copies after publication.
"""

LANGUAGE_CODES = {
    "English → Twi": ("eng_Latn", "twi_Latn"),
    "Twi → English": ("twi_Latn", "eng_Latn"),
}

TTS_ENDPOINTS = {
    "English": "tts_english",
    "Twi": "tts_twi",
}


def endpoint_status():
    lines = ["**Hosted endpoint configuration**"]
    lines.extend(
        f"- `{variable}`: {'configured' if os.environ.get(variable) else 'not configured'}"
        for variable in ENDPOINT_ENV.values()
    )
    lines.append(
        f"- `HF_TOKEN`: {'configured' if os.environ.get('HF_TOKEN') else 'not configured'}"
    )
    return "\n".join(lines)


def inference_client(endpoint_key):
    endpoint_env = ENDPOINT_ENV[endpoint_key]
    endpoint_url = os.environ.get(endpoint_env)
    if not endpoint_url:
        raise gr.Error(
            f"Set `{endpoint_env}` to the URL of a deployed Hugging Face Inference Endpoint."
        )

    token = os.environ.get("HF_TOKEN")
    if not token:
        raise gr.Error(
            "Set `HF_TOKEN` as a Codespaces secret with permission to call the endpoint."
        )

    return InferenceClient(model=endpoint_url, token=token, timeout=300)


def transcribe_hosted(audio_bytes):
    result = inference_client("asr").automatic_speech_recognition(audio_bytes)
    transcript = result.text.strip()
    return transcript or "No speech detected. Try a louder or clearer clip."


def translate_text(text, direction):
    if not text.strip():
        raise gr.Error("Enter or transcribe text before translating.")
    if direction not in LANGUAGE_CODES:
        raise gr.Error("Choose English → Twi or Twi → English.")

    src_lang, tgt_lang = LANGUAGE_CODES[direction]
    result = inference_client("translation").translation(
        text.strip(),
        src_lang=src_lang,
        tgt_lang=tgt_lang,
    )
    return result.translation_text.strip()


def synthesize_speech(text, language):
    if not text.strip():
        raise gr.Error("Enter text before generating speech.")
    if language not in TTS_ENDPOINTS:
        raise gr.Error("Choose English or Twi speech.")

    audio_bytes = inference_client(TTS_ENDPOINTS[language]).text_to_speech(text.strip())
    try:
        audio, sample_rate = sf.read(
            io.BytesIO(audio_bytes),
            dtype="float32",
            always_2d=False,
        )
    except (RuntimeError, ValueError) as error:
        raise gr.Error(
            "The TTS endpoint returned an unsupported audio format."
        ) from error

    audio = np.asarray(audio, dtype=np.float32)
    if audio.ndim == 2:
        audio = audio.mean(axis=1)
    if audio.size == 0 or not np.isfinite(audio).all():
        raise gr.Error("The TTS endpoint returned empty or invalid audio.")
    return int(sample_rate), audio


def publish_example(audio_bytes, transcript, language, consent):
    if not consent:
        raise gr.Error("Confirm the public-sharing consent checkbox before uploading.")
    if not transcript.strip():
        raise gr.Error("Transcribe or enter a transcript before sharing.")
    if transcript.strip().startswith("No speech detected."):
        raise gr.Error("There is no transcript to contribute for this clip.")
    if not audio_bytes:
        raise gr.Error("The audio clip is empty.")
    if language not in {"English", "Twi", "Code-switched English–Twi"}:
        raise gr.Error("Choose the clip's language before sharing.")

    token = os.environ.get("HF_TOKEN")
    if not token:
        raise gr.Error(
            "Set `HF_TOKEN` as a Codespaces secret with write access to the dataset."
        )

    api = HfApi(token=token)
    api.create_repo(
        repo_id=DATASET_REPO_ID,
        repo_type="dataset",
        private=False,
        exist_ok=True,
    )
    repo_info = api.repo_info(DATASET_REPO_ID, repo_type="dataset")
    if repo_info.private:
        raise gr.Error(
            f"{DATASET_REPO_ID} is private. Make the dataset public before sharing clips."
        )

    if not api.file_exists(
        repo_id=DATASET_REPO_ID,
        filename="README.md",
        repo_type="dataset",
    ):
        api.upload_file(
            path_or_fileobj=DATASET_CARD.encode("utf-8"),
            path_in_repo="README.md",
            repo_id=DATASET_REPO_ID,
            repo_type="dataset",
            commit_message="Add opt-in evaluation dataset card",
        )

    example_id = uuid4().hex
    prefix = f"examples/{example_id}"
    metadata = {
        "id": example_id,
        "transcript": transcript.strip(),
        "language": language,
        "sample_rate": 16_000,
        "license": "cc-by-4.0",
    }
    with TemporaryDirectory(prefix="kasaspeech-share-") as temp_dir:
        folder = Path(temp_dir)
        (folder / "audio.wav").write_bytes(audio_bytes)
        (folder / "metadata.json").write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        api.upload_folder(
            folder_path=str(folder),
            path_in_repo=prefix,
            repo_id=DATASET_REPO_ID,
            repo_type="dataset",
            commit_message=f"Add consented audio example {example_id}",
        )
    return f"Shared to https://huggingface.co/datasets/{DATASET_REPO_ID}/tree/main/{prefix}"
