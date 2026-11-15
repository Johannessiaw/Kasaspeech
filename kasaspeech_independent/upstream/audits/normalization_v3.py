
import re, unicodedata
APOS = r"[’‘'ʼ]"
def normalize_transcript_v3(text):
    text = unicodedata.normalize("NFC", text)
    text = text.replace("Ɛ", "ɛ").replace("Ɔ", "ɔ").lower()
    text = re.sub(APOS, "", text)                      # delete apostrophes, no space
    text = re.sub(r"[^a-zɔɛáãéíóúĩũõàèìòŋƒɖɣʋẽâçêëîïôùûüœẹ]", " ", text)  # hyphens, quotes, punctuation -> space
    return re.sub(r"\s+", " ", text).strip()
