---
language:
  - ada
  - ee
  - fat
  - fr
  - gaa
  - nzi
  - tw
  - en
license: apache-2.0
library_name: transformers
pipeline_tag: automatic-speech-recognition
tags:
  - speech
  - asr
  - african-languages
  - w2v-bert
  - multilingual
  - khaya
  - arxiv:2607.21540
metrics:
  - wer
model-index:
  - name: w2v-bert-ada_ewe_fat_fra_gaa_nzi_twi_en
    results:
      - task:
          type: automatic-speech-recognition
          name: Automatic Speech Recognition
        metrics:
          - type: wer
            value: 11.4
            name: WER
---

![dondo_v1_graphic](https://cdn-uploads.huggingface.co/production/uploads/5f49548279c1ba4c353d122c/NMp40RI78sjS1fWQUzlUc.png)
# w2v-bert-ada_ewe_fat_fra_gaa_nzi_twi_en — Southern Ghana multilingual ASR

**DONDO** (Democratizing Oral Neural Dialect Ontology) open **multilingual** speech-recognition base model for
**Southern Ghana**. A single checkpoint covering: English, Adangme, Ewe, Fante, French, Ga, Nzema, Asante Twi. Fine-tuned from
**w2v-BERT 2.0**.

- **Region:** Southern Ghana
- **Languages:** English, Adangme, Ewe, Fante, French, Ga, Nzema, Asante Twi
- **Task:** Automatic Speech Recognition (CTC), language-conditioned
- **Backbone:** w2v-BERT 2.0
- **License:** Apache-2.0 (attribution only; commercial use permitted)
- **Best result:** 11.4% average WER (Step 2)
- **Paper:** [arXiv:2607.21540](https://arxiv.org/abs/2607.21540)
- **Demo:** [Try it in your browser](https://huggingface.co/spaces/Ghana-NLP/Southern-Ghana-ASR)
- **Part of:** the DONDO family — <https://huggingface.co/KhayaAI>

## Intended use

A **multilingual base model** for the languages of Southern Ghana. One checkpoint
transcribes any of its languages when steered with a language prefix (below). Use
directly, or fine-tune further on your own in-domain data. DONDO is also an **open
test bed** for new low-resource speech techniques; aligned research groups are
welcome to collaborate.

## Training data

Primarily read speech derived from **religious texts** with verified transcripts
in standard orthography, pooled across the region's languages so the shared
encoder learns cross-lingual acoustic structure (especially helpful for the
smallest languages).

## Training procedure

Two-step **learning-rate-annealed** fine-tuning (a third step for some families):

1. **Step 1 — coarse adaptation** (LR 5e-5): adapt the shared encoder to the full
   multilingual mixture.
2. **Step 2 — annealing** (LR 5e-6): recover most of the gap to monolingual
   baselines; for some languages, surpass them.
3. **Step 3 — optional** (LR 5e-7): a further small improvement.

## Evaluation — WER (%)

| Setting | Avg | English | Adangme | Ewe | Fante | French | Ga | Nzema | Asante Twi |
|---|---|---|---|---|---|---|---|---|---|
| Monolingual | **—** | 16.9 | 5.38 | 4.5 | 30.1 | 8.5 | 9.7 | 12.6 | 15.75 |
| Step 1 (5e-5) | **14.7** | 34.9 | 11.6 | 8.41 | 18.1 | 6.87 | 19.4 | 27.9 | 19.3 |
| Step 2 (5e-6) | **11.4** | 27.4 | 8.78 | 6.57 | 13.4 | 3.64 | 16.0 | 20.8 | 14.7 |

"x" = not evaluated; "-" = not computed at that step. Lower is better.

## How to use

This is a **multilingual** model. Language identity is injected as a short
one-hot *language prefix* prepended to the acoustic features, so you must tell
the model which language to transcribe. **Not sure where to start? Try the
interactive [Demo](https://huggingface.co/spaces/Ghana-NLP/Southern-Ghana-ASR) linked above first.**

Use the exact `language_map` below (shared across all DONDO multilingual models):

```python
import torch, torchaudio
from transformers import AutoProcessor, AutoModelForCTC

model_id = "KhayaAI/w2v-bert-ada_ewe_fat_fra_gaa_nzi_twi_en"
processor = AutoProcessor.from_pretrained(model_id)
model = AutoModelForCTC.from_pretrained(model_id)

# Full language -> prefix-id map used by the DONDO multilingual models:
language_map = {"Adangme": 0, "Akuapem Twi": 1, "Asante Twi": 2, "Dagbani": 3, "Dagaare": 4,
                "Ewe": 5, "African English": 6, "Fante": 7, "French": 8, "Ga": 9, "Gonja": 10,
                "Gurene": 11, "Hausa": 12, "Igbo": 13, "Kasem": 14, "Kikuyu": 15,
                "Konkomba (Likpakpaanl)": 16, "Konkomba (Likoonli)": 17, "Krio": 18,
                "Kusaal": 19, "Luo": 20, "Mampruli": 21, "Mende": 22, "Meru/Kimeru": 23,
                "Nzema": 24, "Pidgin": 25, "Shona": 26, "Swahili": 27, "Temne": 28,
                "Wali": 29, "Wolof": 30, "Yoruba": 31}

def add_language_prefix(features, lang_id, num_langs, prefix_len=1):
    # features: (time, feature_dim). Build a one-hot language vector, map it
    # into the feature dimension, repeat over `prefix_len` frames and prepend.
    T, D = features.shape
    lang_vec = torch.zeros(D)
    lang_vec[lang_id % D] = 1.0                 # crude one-hot -> feature bin
    prefix = lang_vec.unsqueeze(0).repeat(prefix_len, 1)
    return torch.cat([prefix, features], dim=0)

speech, sr = torchaudio.load("audio.wav")
if sr != 16000:
    speech = torchaudio.functional.resample(speech, sr, 16000)
feats = processor(speech.squeeze().numpy(), sampling_rate=16000,
                  return_tensors="pt").input_features[0]

lang_id = language_map["Asante Twi"]   # pick any language this model supports
feats = add_language_prefix(feats, lang_id, num_langs=len(language_map))

with torch.no_grad():
    logits = model(input_features=feats.unsqueeze(0)).logits
pred_ids = torch.argmax(logits, dim=-1)
print(processor.batch_decode(pred_ids)[0])
```

## Limitations

Read-religious-text domain; specify the target language via the prefix (no
built-in language ID yet). WERs are in-domain. The African English column is
harder in the multilingual setting than in a dedicated model.

## License

Released under the **Apache-2.0** license. You are free to use, modify, redistribute and build upon this model, **including for commercial purposes**. The only substantive requirement is **attribution**.

## Professional services & hosted APIs

This model is free to use under Apache-2.0. If your team would like help
**deploying it offline on your own infrastructure and data**, Khaya AI offers
professional services (integration, fine-tuning and on-premises deployment). For
ready-to-use and more advanced ASR, including **APIs** for interested parties,
see Khaya Studio.

- Khaya AI — <https://khaya.ai>
- Khaya Studio — <https://studio.khaya.ai>
- Khaya Studio ASR — <https://studio.khaya.ai/asr>

## Citation

```bibtex
@article{azunre2026dondo,
  title         = {DONDO: Open w2v-BERT Speech Recognition Base Models for African Languages},
  author        = {Azunre, Paul and Ibrahim, Naafi and Budu, Joel and Adu-Gyamfi, Lawrence},
  year          = {2026},
  eprint        = {2607.21540},
  archivePrefix = {arXiv},
  primaryClass  = {cs.CL},
  note          = {Democratizing Oral Neural Dialect Ontology. Funded by the Huniki Federation.}
}
```

## Acknowledgements

Funded by the **Huniki Federation**. We thank **Ghana-NLP** and **Algorine Research** for their support with benchmarking, testing and data, and **Hugging Face** for compute credits. We also thank the language communities and data contributors whose recordings and transcriptions made this work possible.
