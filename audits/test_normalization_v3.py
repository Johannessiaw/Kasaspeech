from audits.normalization_v3 import normalize_transcript_v3


def test_preserves_twi_combining_marks_and_digits():
    assert normalize_transcript_v3("ɔ̃ ɛ́ ɛ̃ 123") == "ɔ̃ ɛ́ ɛ̃ 123"
