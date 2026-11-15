import unittest
from unittest.mock import Mock, patch

import gradio as gr
import numpy as np
import torch

from kasaspeech_independent.app import (
    HOSTED_MODE,
    LOCAL_MODE,
    audio_to_wav_bytes,
    prepare_audio,
    preview_audio,
    transcribe,
)


class PrepareAudioTests(unittest.TestCase):
    def test_accepts_mono_audio_at_model_sample_rate(self):
        samples = np.linspace(-1, 1, 160, dtype=np.float32)

        result = prepare_audio((16_000, samples))

        np.testing.assert_array_equal(result, samples)

    def test_converts_stereo_to_mono_and_resamples(self):
        left = np.ones(480, dtype=np.float32)
        right = np.zeros(480, dtype=np.float32)
        channel_first = np.stack((left, right))
        channel_last = channel_first.T

        first_result = prepare_audio((48_000, channel_first))
        second_result = prepare_audio((48_000, channel_last))

        self.assertEqual(first_result.shape, (160,))
        self.assertEqual(second_result.shape, (160,))
        np.testing.assert_allclose(first_result, second_result, atol=1e-5)
        np.testing.assert_allclose(first_result[20:-20], 0.5, atol=1e-3)

    def test_rejects_missing_or_invalid_audio(self):
        with self.assertRaisesRegex(gr.Error, "Upload or record"):
            prepare_audio(None)
        with self.assertRaisesRegex(gr.Error, "empty"):
            prepare_audio((16_000, np.array([], dtype=np.float32)))
        with self.assertRaisesRegex(gr.Error, "invalid sample"):
            prepare_audio((16_000, np.array([np.nan], dtype=np.float32)))

    def test_preview_includes_playable_audio_and_waveform(self):
        samples = np.sin(np.linspace(0, 10, 160, dtype=np.float32))
        audio = (16_000, samples)

        preview, waveform, selected, button = preview_audio(audio)

        self.assertIs(preview, audio)
        self.assertIs(selected, audio)
        self.assertIn("<svg", waveform)
        self.assertIn("<rect", waveform)
        self.assertTrue(button["interactive"])

    def test_audio_is_encoded_as_mono_16khz_wav(self):
        wav_bytes = audio_to_wav_bytes((48_000, np.zeros(480, dtype=np.float32)))

        self.assertTrue(wav_bytes.startswith(b"RIFF"))
        self.assertEqual(len(wav_bytes), 44 + 160 * 2)

    @patch("kasaspeech_independent.app.load_model")
    def test_transcribe_runs_processor_and_ctc_decoder(self, load_model):
        processor = Mock()
        processor.return_value.input_features = torch.zeros((1, 4, 160))
        processor.batch_decode.return_value = ["hello twi"]
        model = Mock()
        model.return_value.logits = torch.tensor([[[0.0, 1.0]]])
        load_model.return_value = processor, model, torch.device("cpu")

        transcript, transcript_state = transcribe(
            (16_000, np.zeros(160, dtype=np.float32)),
            LOCAL_MODE,
        )

        self.assertEqual(transcript, "hello twi")
        self.assertEqual(transcript_state, transcript)
        model.assert_called_once()
        load_model.assert_called_once()

    @patch("kasaspeech_independent.app.load_model")
    def test_transcribe_reports_empty_decode_without_crashing(self, load_model):
        processor = Mock()
        processor.return_value.input_features = torch.zeros((1, 4, 160))
        processor.batch_decode.return_value = [""]
        model = Mock()
        model.return_value.logits = torch.zeros((1, 2, 2))
        load_model.return_value = processor, model, torch.device("cpu")

        transcript, _ = transcribe(
            (16_000, np.zeros(160, dtype=np.float32)),
            LOCAL_MODE,
        )

        self.assertIn("No speech detected", transcript)

    @patch("kasaspeech_independent.app.hf_services.transcribe_hosted")
    def test_hosted_transcribe_sends_encoded_audio(self, transcribe_hosted):
        transcribe_hosted.return_value = "hello twi"

        transcript, _ = transcribe(
            (16_000, np.zeros(160, dtype=np.float32)),
            HOSTED_MODE,
        )

        self.assertEqual(transcript, "hello twi")
        self.assertTrue(transcribe_hosted.call_args.args[0].startswith(b"RIFF"))


if __name__ == "__main__":
    unittest.main()
