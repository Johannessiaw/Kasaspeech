
import os, datetime, pandas as pd
from huggingface_hub import HfApi, hf_hub_download
from kaggle_secrets import UserSecretsClient
from transformers import AutoProcessor

HF_TOKEN = UserSecretsClient().get_secret("HF_TOKEN")
REPO  = "JOHANNES02/KASASPEECH"
MODEL = "KhayaAI/w2v-bert-ada_ewe_fat_fra_gaa_nzi_twi_en"
DS    = "Kennethdot/Ghana_English-Twi_Code-switching_Speech"
api = HfApi(token=HF_TOKEN)
os.makedirs("audits", exist_ok=True)

def push(*paths):
    for p in paths:
        api.upload_file(path_or_fileobj=p, path_in_repo=p, repo_id=REPO, repo_type="model")
    print("pushed:", list(paths))

def log_step(text):
    p = "audits/progress_log.md"
    try:
        old = open(hf_hub_download(REPO, p, repo_type="model", token=HF_TOKEN,
                                   force_download=True)).read()
    except Exception:
        old = "# KasaSpeech progress log\n"
    stamp = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    open(p, "w").write(old.rstrip("\n") + f"\n- {stamp}: {text}\n")
    push(p)

df = pd.read_csv(hf_hub_download(REPO, "audits/normalization_v3_manifest.csv",
        repo_type="model", token=HF_TOKEN), dtype={"speaker_id": str}, keep_default_na=False)
processor = AutoProcessor.from_pretrained(MODEL); tok = processor.tokenizer

m = df[~df["empty"]].copy()
ids = [tok(t).input_ids for t in m["normalized_transcript"]]
m["label_len"]  = [len(x) for x in ids]
m["repeats"]    = [sum(1 for a, b in zip(x, x[1:]) if a == b) for x in ids]
m["ctc_needed"] = m["label_len"] + m["repeats"]
m["frames"]     = (m["duration"] * 24.9).astype(int)
m["ratio"]      = m["ctc_needed"] / m["frames"]
m["cps"]        = m["label_len"] / m["duration"]

EXCL = {"train": [7837, 8333, 29958, 38521, 38678, 38770, 39685, 45856, 46026, 46669, 48590],
        "validation": [253, 1607], "test": [390, 859, 864]}

def original_index(split, clean_idx):
    o = clean_idx
    for e in sorted(EXCL[split]):
        if e <= o: o += 1
    return o

def load_clean():
    """Downloads the source dataset (slow) and rebuilds `clean`. Only needed for listening/audio checks."""
    global clean
    from datasets import load_dataset
    original = load_dataset(DS, token=HF_TOKEN)
    clean = {s: ds.select([i for i in range(len(ds)) if i not in set(EXCL[s])])
             for s, ds in original.items()}
    for s in clean:
        a = clean[s]["transcript"]
        b = df[df["split"] == s].sort_values("clean_index")["transcript"].tolist()
        print(s, len(clean[s]), "matches manifest:", a == b)
