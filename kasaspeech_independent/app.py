import io
import os
import wave
from functools import lru_cache

import gradio as gr
import numpy as np
import torch
import torchaudio
from transformers import AutoProcessor, Wav2Vec2BertForCTC

from kasaspeech_independent import hf_services

MODEL_ID = "JOHANNES02/KASASPEECH-dondo-v2"
SAMPLE_RATE = 16_000
LOCAL_MODE = "Local KasaSpeech checkpoint"
HOSTED_MODE = "Hosted Hugging Face endpoint"


def audio_to_wav_bytes(audio):
    samples = prepare_audio(audio)
    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2")
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm.tobytes())
    return output.getvalue()


def waveform_html(audio):
    if not isinstance(audio, (tuple, list)) or len(audio) != 2:
        return '<div class="waveform-empty">Your recording waveform will appear here.</div>'

    _, samples = audio
    samples = np.asarray(samples, dtype=np.float32)
    if samples.ndim == 2:
        if samples.shape[0] <= 8 and samples.shape[1] > samples.shape[0]:
            samples = samples.mean(axis=0)
        else:
            samples = samples.mean(axis=1)
    if samples.ndim != 1 or samples.size == 0:
        return '<div class="waveform-empty">No audio waveform to display.</div>'

    bars = 180
    window = max(1, int(np.ceil(samples.size / bars)))
    peaks = [
        float(np.max(np.abs(samples[start : start + window])))
        for start in range(0, samples.size, window)
    ][:bars]
    rects = []
    for index, peak in enumerate(peaks):
        height = max(3.0, min(48.0, peak * 48.0))
        y = 50.0 - height / 2
        rects.append(
            f'<rect x="{index * 4 + 1}" y="{y:.1f}" width="2.2" '
            f'height="{height:.1f}" rx="1.1"/>'
        )
    return (
        '<div class="waveform"><svg viewBox="0 0 720 100" role="img" '
        'aria-label="Audio waveform" preserveAspectRatio="none">'
        '<line x1="0" y1="50" x2="720" y2="50" class="wave-center"/>'
        + "".join(rects)
        + "</svg></div>"
    )


def preview_audio(audio):
    if audio is None:
        return (
            None,
            waveform_html(None),
            None,
            gr.update(interactive=False),
        )
    prepare_audio(audio)
    return audio, waveform_html(audio), audio, gr.update(interactive=True)


@lru_cache(maxsize=1)
def load_model():
    processor = AutoProcessor.from_pretrained(
        MODEL_ID,
    )
    model = Wav2Vec2BertForCTC.from_pretrained(
        MODEL_ID,
    )
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    model.eval()
    return processor, model, device


def prepare_audio(audio):
    if not isinstance(audio, (tuple, list)) or len(audio) != 2:
        raise gr.Error("Upload or record an audio clip first.")

    sample_rate, samples = audio
    try:
        sample_rate = int(sample_rate)
    except (TypeError, ValueError) as error:
        raise gr.Error("Could not read the audio sample rate.") from error
    if sample_rate <= 0:
        raise gr.Error("The audio sample rate must be positive.")

    samples = np.asarray(samples, dtype=np.float32)
    if samples.ndim == 2:
        if samples.shape[0] <= 8 and samples.shape[1] > samples.shape[0]:
            samples = samples.mean(axis=0)
        else:
            samples = samples.mean(axis=1)
    elif samples.ndim != 1:
        raise gr.Error("Expected mono or stereo audio.")

    if samples.size == 0:
        raise gr.Error("The audio clip is empty.")
    if not np.isfinite(samples).all():
        raise gr.Error("The audio contains invalid sample values.")

    waveform = torch.from_numpy(np.ascontiguousarray(samples))
    if sample_rate != SAMPLE_RATE:
        waveform = torchaudio.functional.resample(
            waveform,
            orig_freq=sample_rate,
            new_freq=SAMPLE_RATE,
        )
    return waveform.numpy()


def transcribe(audio, mode):
    if mode == HOSTED_MODE:
        transcript = hf_services.transcribe_hosted(audio_to_wav_bytes(audio))
    elif mode == LOCAL_MODE:
        waveform = prepare_audio(audio)
        processor, model, device = load_model()
        features = processor(
            waveform,
            sampling_rate=SAMPLE_RATE,
            return_tensors="pt",
        ).input_features.to(device)

        with torch.inference_mode():
            logits = model(input_features=features).logits
        transcript = processor.batch_decode(logits.argmax(dim=-1))[0].strip()
        if not transcript:
            transcript = "No speech detected. Try a louder or clearer clip."
    else:
        raise gr.Error("Choose a supported ASR mode.")
    return transcript, transcript


def publish_selected_audio(audio, transcript, language, consent):
    if not consent:
        raise gr.Error("Confirm the public-sharing consent checkbox before uploading.")
    audio_bytes = audio_to_wav_bytes(audio)
    message = hf_services.publish_example(
        audio_bytes,
        transcript,
        language,
        consent,
    )
    return message, gr.update(value=False)


def copy_text(text):
    return text or ""


CSS = """
.waveform {
  background: linear-gradient(110deg, #f0fdfa, #eff6ff);
  border: 1px solid #ccfbf1;
  border-radius: 14px;
  padding: 8px 12px;
  min-height: 76px;
}
.waveform svg { width: 100%; height: 72px; }
.waveform rect { fill: #0f766e; }
.waveform .wave-center { stroke: #99f6e4; stroke-width: 1; }
.waveform-empty {
  min-height: 76px;
  display: grid;
  place-items: center;
  border: 1px dashed #94a3b8;
  border-radius: 14px;
  color: #64748b;
}
"""

with gr.Blocks(
    title="KasaSpeech Studio",
    theme=gr.themes.Soft(
        primary_hue="teal",
        secondary_hue="amber",
        neutral_hue="slate",
    ),
    css=CSS,
) as demo:
    gr.Markdown(
        """
        # KasaSpeech Studio
        ### Record · review · transcribe · translate · listen

        Audio is sent to this Codespace to create the waveform and playback
        preview. Hosted ASR sends it to your configured Hugging Face endpoint;
        local ASR stays in this Codespace. Public dataset sharing is separate
        and always requires per-clip consent.
        """
    )

    with gr.Accordion("Hugging Face connection status", open=False):
        gr.Markdown(hf_services.endpoint_status())
        gr.Markdown(
            "The model repositories do not currently have hosted Inference "
            "Providers. Hosted features need dedicated Hugging Face Inference "
            "Endpoints, configured as Codespaces environment secrets. Translation "
            "and TTS send text to their configured endpoints."
        )

    with gr.Tab("Speech recognition"):
        selected_audio = gr.State()
        transcript_state = gr.State("")
        mode = gr.Radio(
            choices=[HOSTED_MODE, LOCAL_MODE],
            value=HOSTED_MODE,
            label="Recognition mode",
        )
        gr.Markdown(
            "The hosted mode uses a dedicated endpoint. Choose Local KasaSpeech "
            "checkpoint to run the fine-tuned model in this Codespace."
        )
        with gr.Tabs():
            with gr.Tab("Record"):
                recording_input = gr.Audio(
                    sources=["microphone"],
                    type="numpy",
                    label="1. Record English–Twi speech",
                )
                record_waveform = gr.HTML(waveform_html(None))
                record_preview = gr.Audio(
                    label="2. Play back and review your recording",
                    interactive=False,
                )
            with gr.Tab("Upload"):
                upload_input = gr.Audio(
                    sources=["upload"],
                    type="numpy",
                    label="1. Upload an audio clip",
                )
                upload_waveform = gr.HTML(waveform_html(None))
                upload_preview = gr.Audio(
                    label="2. Play back and review your audio",
                    interactive=False,
                )
        transcribe_button = gr.Button(
            "3. Transcribe reviewed audio",
            variant="primary",
            interactive=False,
        )
        transcript_output = gr.Textbox(
            label="Transcript (editable)",
            lines=5,
            placeholder="Your transcript will appear here.",
        )
        recording_input.change(
            fn=preview_audio,
            inputs=recording_input,
            outputs=[
                record_preview,
                record_waveform,
                selected_audio,
                transcribe_button,
            ],
        )
        upload_input.change(
            fn=preview_audio,
            inputs=upload_input,
            outputs=[
                upload_preview,
                upload_waveform,
                selected_audio,
                transcribe_button,
            ],
        )
        transcribe_button.click(
            fn=transcribe,
            inputs=[selected_audio, mode],
            outputs=[transcript_output, transcript_state],
        )
        transcript_output.change(
            fn=copy_text,
            inputs=transcript_output,
            outputs=transcript_state,
        )

        with gr.Accordion("Optional: share a clip for public evaluation", open=False):
            gr.Markdown(
                f"""
                Destination: [`{hf_services.DATASET_REPO_ID}`](https://huggingface.co/datasets/{hf_services.DATASET_REPO_ID}).
                If it does not exist, the first opted-in upload will create it as
                a **public dataset**. Each upload contains only the audio and
                transcript; it is released under **CC BY 4.0**. Public files can
                be copied and cannot be recalled from other people's copies.
                """
            )
            share_language = gr.Dropdown(
                choices=["English", "Twi", "Code-switched English–Twi"],
                label="Clip language",
                value="Code-switched English–Twi",
            )
            share_consent = gr.Checkbox(
                label=(
                    "I am the speaker or have permission to publish this clip "
                    "and transcript under CC BY 4.0, have removed personal "
                    "information, and understand they will be public and "
                    "downloadable."
                ),
                value=False,
            )
            share_button = gr.Button("Publish this clip to the public dataset")
            share_result = gr.Markdown()
            share_button.click(
                fn=publish_selected_audio,
                inputs=[
                    selected_audio,
                    transcript_output,
                    share_language,
                    share_consent,
                ],
                outputs=[share_result, share_consent],
            )
            recording_input.change(
                fn=lambda: gr.update(value=False),
                inputs=None,
                outputs=share_consent,
            )
            upload_input.change(
                fn=lambda: gr.update(value=False),
                inputs=None,
                outputs=share_consent,
            )
            transcript_output.change(
                fn=lambda: gr.update(value=False),
                inputs=None,
                outputs=share_consent,
            )
            share_language.change(
                fn=lambda: gr.update(value=False),
                inputs=None,
                outputs=share_consent,
            )

    with gr.Tab("Translation"):
        gr.Markdown(
            """
            NLLB supports English and Twi text. Select the source direction
            explicitly; automatic code-switch detection is not provided. This
            research checkpoint is **CC-BY-NC-4.0** (non-commercial use only),
            and translations are not certified.
            """
        )
        translation_input = gr.Textbox(
            label="Text to translate",
            lines=5,
            placeholder="Paste text or use your transcript.",
        )
        use_transcript_button = gr.Button("Use ASR transcript")
        translation_direction = gr.Radio(
            choices=list(hf_services.LANGUAGE_CODES),
            value="English → Twi",
            label="Direction",
        )
        translate_button = gr.Button("Translate", variant="primary")
        translation_output = gr.Textbox(
            label="Translation (editable)",
            lines=5,
        )
        use_transcript_button.click(
            fn=copy_text,
            inputs=transcript_state,
            outputs=translation_input,
        )
        translate_button.click(
            fn=hf_services.translate_text,
            inputs=[translation_input, translation_direction],
            outputs=translation_output,
        )

    with gr.Tab("Text to speech"):
        gr.Markdown(
            """
            Generate speech from English or Twi text using dedicated Hugging
            Face endpoints. The referenced MMS English and Akan/Twi checkpoints
            are **CC-BY-NC-4.0** (non-commercial use only).
            """
        )
        tts_input = gr.Textbox(
            label="Text to speak",
            lines=4,
            placeholder="Enter text or use the transcript/translation.",
        )
        with gr.Row():
            use_transcript_for_tts = gr.Button("Use ASR transcript")
            use_translation_for_tts = gr.Button("Use translation")
        tts_language = gr.Radio(
            choices=["English", "Twi"],
            value="English",
            label="Voice language",
        )
        tts_button = gr.Button("Generate speech", variant="primary")
        tts_output = gr.Audio(label="Generated speech", interactive=False)
        use_transcript_for_tts.click(
            fn=copy_text,
            inputs=transcript_state,
            outputs=tts_input,
        )
        use_translation_for_tts.click(
            fn=copy_text,
            inputs=translation_output,
            outputs=tts_input,
        )
        tts_button.click(
            fn=hf_services.synthesize_speech,
            inputs=[tts_input, tts_language],
            outputs=tts_output,
        )


if __name__ == "__main__":
    demo.queue(default_concurrency_limit=1).launch(
        server_name="0.0.0.0",
        server_port=int(os.environ.get("PORT", "7860")),
        share=False,
        show_error=True,
    )
