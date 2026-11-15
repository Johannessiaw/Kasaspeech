
"""Kaggle training cell; run after the project setup cells.

The notebook namespace must provide CONFIG, REPO, HF_TOKEN, hf_hub_download,
processor, tok, api, MODEL, log_step, and load_clean. `clean` may already be
loaded; otherwise load_clean() rebuilds it from the source dataset.
"""

import os, time, json, gc, numpy as np, pandas as pd, torch, jiwer
from transformers import Wav2Vec2BertForCTC
from huggingface_hub import snapshot_download

from audits.normalization_v3 import normalize_transcript_v3

C = CONFIG
REMOTE = "train/" + C["RUN"]
dev = "cuda"
if "clean" not in globals():
    load_clean()

def load(audio):
    if hasattr(audio, "get_all_samples"):
        s = audio.get_all_samples(); return s.data.squeeze(0).numpy(), s.sample_rate
    return audio["array"], audio["sampling_rate"]

v2 = pd.read_csv(hf_hub_download(REPO, "audits/training_manifest_v2.csv", repo_type="model",
        token=HF_TOKEN, force_download=True), dtype={"speaker_id": str},
        keep_default_na=False, low_memory=False)
tr = v2[(v2["split"] == "train") & v2["usable"] & v2["standard"]].reset_index(drop=True)
dur = tr["audio_secs"].to_numpy()          # real audio length, not the metadata field
val = v2[(v2["split"] == "validation") & v2["usable"] & v2["standard"]]
val = val.sample(min(C["VAL_ROWS"], len(val)), random_state=0).sort_values("audio_secs")

def make_batches(epoch):
    rng = np.random.RandomState(1000 + epoch)
    idx = rng.permutation(len(tr)); batches = []
    for s in range(0, len(idx), 2000):
        chunk = sorted(idx[s:s + 2000], key=lambda i: dur[i])
        cur = []
        for i in chunk:
            if cur and (len(cur) + 1) * dur[i] > C["MAX_SEC"]:
                batches.append(cur); cur = []
            cur.append(i)
        if cur: batches.append(cur)
    order = rng.permutation(len(batches))
    return [batches[k] for k in order]

def collate(b):
    rows = tr.iloc[b]
    wavs = [load(clean["train"][int(i)]["audio"])[0] for i in rows["clean_index"]]
    inp = processor.feature_extractor(wavs, sampling_rate=16000,
                                      return_tensors="pt", padding=True).to(dev)
    ids = [tok(t).input_ids for t in rows["normalized_transcript"]]
    labels = torch.full((len(ids), max(len(x) for x in ids)), -100, dtype=torch.long)
    for k, x in enumerate(ids):
        labels[k, :len(x)] = torch.tensor(x)
    return inp, labels.to(dev)

# ---- model: resume from repo checkpoint if one exists ----
CFGKW = dict(ctc_loss_reduction="mean", ctc_zero_infinity=True, attention_dropout=0.0,
             hidden_dropout=0.0, feat_proj_dropout=0.0, layerdrop=0.0,
             mask_time_prob=0.05, mask_time_length=10)
local = snapshot_download(REPO, repo_type="model", token=HF_TOKEN,
                          allow_patterns=[REMOTE + "/ckpt/*"], force_download=True)
ck = os.path.join(local, REMOTE, "ckpt")
if os.path.exists(os.path.join(ck, "state.json")):
    with open(os.path.join(ck, "state.json"), encoding="utf-8") as state_file:
        state = json.load(state_file)
    model = Wav2Vec2BertForCTC.from_pretrained(ck)
    print("RESUMING at update", state["update"], "epoch", state["epoch"])
else:
    state = dict(epoch=0, next_batch=0, update=0, minutes=0.0)
    model = Wav2Vec2BertForCTC.from_pretrained(MODEL, **CFGKW)
    print("FRESH START")
model.to(dev); model.gradient_checkpointing_enable(); model.train()

opt = torch.optim.AdamW(model.parameters(), lr=C["LR"], weight_decay=C["WD"])
scaler = torch.amp.GradScaler("cuda")

A = C["ACCUM"]
U_ep = len(make_batches(0)) // A
total = C["EPOCHS"] * U_ep
warm = max(1, int(C["WARMUP"] * total))
def lr_at(u):
    return C["LR"] * (u + 1) / warm if u < warm else C["LR"] * max(0.0, (total - u) / (total - warm))
print(f"updates/epoch={U_ep} total={total} (about {len(tr)} rows, {dur.sum()/3600:.1f} h audio)")

try:
    hist = pd.read_csv(hf_hub_download(REPO, REMOTE + "/train_log.csv", repo_type="model",
                       token=HF_TOKEN, force_download=True)).to_dict("records")
except Exception:
    hist = []

def evaluate():
    model.eval(); hyps = []
    with torch.no_grad():
        for b in range(0, len(val), 8):
            rows = val.iloc[b:b + 8]
            wavs = [load(clean["validation"][int(i)]["audio"])[0] for i in rows["clean_index"]]
            inp = processor.feature_extractor(wavs, sampling_rate=16000,
                                              return_tensors="pt", padding=True).to(dev)
            with torch.autocast("cuda", dtype=torch.float16):
                logits = model(**inp).logits
            hyps += tok.batch_decode(logits.argmax(-1))
    model.train(); torch.cuda.empty_cache()
    hyps = [normalize_transcript_v3(h) for h in hyps]
    refs = list(val["normalized_transcript"])
    return jiwer.wer(refs, hyps), jiwer.cer(refs, hyps)

def push_log():
    pd.DataFrame(hist).to_csv("train_log.csv", index=False)
    api.upload_file(path_or_fileobj="train_log.csv", path_in_repo=REMOTE + "/train_log.csv",
                    repo_id=REPO, repo_type="model")

fut = None
def save_ckpt(wait=False):
    global fut
    if fut is not None: fut.result()            # never overwrite files still uploading
    model.save_pretrained("ckpt_local", safe_serialization=True)
    with open("ckpt_local/state.json", "w", encoding="utf-8") as state_file:
        json.dump(state, state_file)
    fut = api.upload_folder(folder_path="ckpt_local", path_in_repo=REMOTE + "/ckpt",
                            repo_id=REPO, repo_type="model", run_as_future=True,
                            commit_message="checkpoint at update %d" % state["update"])
    if wait: fut.result()

t_start = time.time(); base_min = state["minutes"]
def minutes(): return base_min + (time.time() - t_start) / 60
def do_eval(tag):
    w, c = evaluate()
    hist.append(dict(update=state["update"], minutes=round(minutes(), 1), kind=tag,
                     val_wer=round(w, 4), val_cer=round(c, 4)))
    print(f"[{tag}] update {state['update']}: val WER {w*100:.2f}%  CER {c*100:.2f}%")
    push_log()

if state["update"] == 0:
    do_eval("start (untrained)")

last_save = time.time(); stop = False; run_loss = []
while state["epoch"] < C["EPOCHS"] and not stop:
    batches = make_batches(state["epoch"])[:U_ep * A]
    while state["next_batch"] < len(batches):
        got = 0; acc = 0.0
        for _ in range(A):
            inp, labels = collate(batches[state["next_batch"]]); state["next_batch"] += 1
            with torch.autocast("cuda", dtype=torch.float16):
                loss = model(**inp, labels=labels).loss
            if torch.isfinite(loss):
                scaler.scale(loss / A).backward(); acc += loss.item(); got += 1
        if got == 0:
            opt.zero_grad(set_to_none=True); continue
        for g in opt.param_groups: g["lr"] = lr_at(state["update"])
        scaler.unscale_(opt)
        gn = torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(opt); scaler.update(); opt.zero_grad(set_to_none=True)
        state["update"] += 1; run_loss.append(acc / got)

        if state["update"] % 50 == 0:
            print(f"update {state['update']}/{total} loss {np.mean(run_loss):.3f} "
                  f"lr {lr_at(state['update']):.2e} gnorm {float(gn):.1f} min {minutes():.0f}")
            hist.append(dict(update=state["update"], minutes=round(minutes(), 1),
                             kind="train", train_loss=round(float(np.mean(run_loss)), 4)))
            run_loss = []
        if state["update"] % C["EVAL_EVERY"] == 0:
            do_eval("val")
        if time.time() - last_save > C["SAVE_EVERY_MIN"] * 60:
            state["minutes"] = minutes(); save_ckpt(); last_save = time.time()
            print("checkpoint upload started at update", state["update"])
        if minutes() > C["MAX_MINUTES"]:
            stop = True; break
    if not stop:
        state["epoch"] += 1; state["next_batch"] = 0

state["minutes"] = minutes()
do_eval("final" if not stop else "time limit")
save_ckpt(wait=True)
log_step(f"Training {C['RUN']}: stopped at update {state['update']}/{total}, "
         f"epoch {state['epoch']}, {minutes():.0f} min. Checkpoint in {REMOTE}/ckpt")
print("DONE" if not stop else "TIME LIMIT REACHED: run the same cell again to resume")
