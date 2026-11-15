import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import gradio as gr

from kasaspeech_independent import hf_services


class HostedServiceTests(unittest.TestCase):
    @patch.dict(os.environ, {}, clear=True)
    def test_requires_configured_hugging_face_endpoint(self):
        with self.assertRaisesRegex(gr.Error, "KASASPEECH_ASR_ENDPOINT_URL"):
            hf_services.inference_client("asr")

    @patch("kasaspeech_independent.hf_services.InferenceClient")
    @patch.dict(
        os.environ,
        {
            "KASASPEECH_TRANSLATION_ENDPOINT_URL": "https://translation.example",
            "HF_TOKEN": "test-token",
        },
        clear=True,
    )
    def test_translation_uses_selected_language_direction(self, client_class):
        client = client_class.return_value
        client.translation.return_value.translation_text = "Akwaaba"

        result = hf_services.translate_text("Welcome", "English → Twi")

        self.assertEqual(result, "Akwaaba")
        client.translation.assert_called_once_with(
            "Welcome",
            src_lang="eng_Latn",
            tgt_lang="twi_Latn",
        )

    @patch("kasaspeech_independent.hf_services.HfApi")
    @patch.dict(os.environ, {}, clear=True)
    def test_public_sharing_requires_explicit_consent(self, api_class):
        with self.assertRaisesRegex(gr.Error, "consent"):
            hf_services.publish_example(
                b"wav",
                "hello",
                "English",
                consent=False,
            )
        api_class.assert_not_called()

    @patch("kasaspeech_independent.hf_services.HfApi")
    @patch.dict(os.environ, {"HF_TOKEN": "test-token"}, clear=True)
    def test_consent_uploads_audio_and_transcript_to_dataset_repo(self, api_class):
        api = api_class.return_value
        api.repo_info.return_value = SimpleNamespace(private=False)
        api.file_exists.return_value = True

        result = hf_services.publish_example(
            b"RIFF-audio",
            "hello",
            "English",
            consent=True,
        )

        self.assertIn(hf_services.DATASET_REPO_ID, result)
        api.create_repo.assert_called_once_with(
            repo_id=hf_services.DATASET_REPO_ID,
            repo_type="dataset",
            private=False,
            exist_ok=True,
        )
        api.upload_folder.assert_called_once()


if __name__ == "__main__":
    unittest.main()
