
import re, unicodedata
APOS = r"[’‘'ʼ]"
def normalize_transcript_v3(text):
    text = unicodedata.normalize("NFC", text)
    text = text.replace("Ɛ", "ɛ").replace("Ɔ", "ɔ").lower()
    text = re.sub(APOS, "", text)                      # delete apostrophes, no space
    allowed = r"a-z0-9ɔɛáãéíóúĩũõàèìòŋƒɖɣʋẽâçêëîïôùûüœẹ"
    text = re.sub(rf"(?<![{allowed}])[\u0300-\u036f]+", " ", text)
    text = re.sub(rf"[^{allowed}\u0300-\u036f]", " ", text)  # punctuation -> space
    return re.sub(r"\s+", " ", text).strip()
