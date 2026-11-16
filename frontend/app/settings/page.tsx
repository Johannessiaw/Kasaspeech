"use client";

import {
  Check,
  CircleAlert,
  Languages,
  LockKeyhole,
  Moon,
  Sun,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { languages } from "@/lib/languages";
import { deleteTranscription, listTranscriptions } from "@/lib/transcription-history";
import {
  defaultPreferences,
  readPreferences,
  savePreferences,
  type UserPreferences,
} from "@/lib/user-preferences";

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [saved, setSaved] = useState(false);
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setPreferences(readPreferences());
    });
    void listTranscriptions()
      .then((entries) => {
        if (active) setHistoryCount(entries.length);
      })
      .catch(() => {
        if (active) setError("Could not read local transcription history.");
      });
    return () => {
      active = false;
    };
  }, []);

  const update = (patch: Partial<UserPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch }));
    setSaved(false);
  };

  const persist = () => {
    try {
      savePreferences(preferences);
      setSaved(true);
      setError("");
    } catch {
      setError("Could not save preferences in this browser. Check site storage permissions.");
    }
  };

  const clearHistory = async () => {
    if (!window.confirm("Delete all saved transcripts and original audio from this browser? This cannot be undone.")) return;
    try {
      const entries = await listTranscriptions();
      await Promise.all(entries.map((entry) => deleteTranscription(entry.id)));
      setHistoryCount(0);
      setError("");
    } catch {
      setError("Could not clear all local history. Some records may remain.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-blue-200/10 bg-[linear-gradient(112deg,#0d2860,#102556_53%,#0b3451)] px-6 py-7 sm:px-8 sm:py-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/[0.08] px-3 py-1.5 text-[10px] font-semibold tracking-[0.15em] text-cyan-100"><Languages aria-hidden="true" className="size-3.5" />PREFERENCES</span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Settings</h1>
        <p className="mt-2 text-sm leading-6 text-blue-100/70">Personal preferences are stored in this browser. Provider credentials remain server-side.</p>
      </section>
      {error && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/[0.08] p-3 text-xs text-rose-100">{error}</p>}

      <section className="rounded-[20px] border border-white/[0.08] bg-[#0a1c3d] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Appearance</h2>
        <p className="mt-1 text-[10px] text-slate-500">Choose the workspace theme.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(["dark", "light"] as const).map((theme) => {
            const active = preferences.theme === theme;
            const Icon = theme === "dark" ? Moon : Sun;
            return <button key={theme} type="button" aria-pressed={active} onClick={() => update({ theme })} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${active ? "border-blue-300/40 bg-blue-400/[0.08]" : "border-white/[0.08] bg-[#071631] hover:border-white/20"}`}>
              <span className="flex size-9 items-center justify-center rounded-lg bg-white/[0.06] text-cyan-200"><Icon aria-hidden="true" className="size-4" /></span>
              <span className="flex-1"><span className="block text-xs font-medium capitalize text-slate-100">{theme} theme</span><span className="mt-1 block text-[10px] text-slate-500">{theme === "dark" ? "Deep navy · recommended" : "Bright workspace"}</span></span>
              {active && <Check aria-hidden="true" className="size-4 text-cyan-300" />}
            </button>;
          })}
        </div>
      </section>

      <section className="rounded-[20px] border border-white/[0.08] bg-[#0a1c3d] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Language defaults</h2>
        <p className="mt-1 text-[10px] text-slate-500">These preferences do not imply that a provider supports the selected language.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Default destination language</span><select value={preferences.defaultLanguage} onChange={(event) => update({ defaultLanguage: event.target.value })} className="h-10 w-full rounded-lg border border-white/[0.1] bg-[#071631] px-3 text-xs text-slate-200 outline-none focus:border-blue-400/60">{languages.map((language) => <option key={language.code} value={language.code}>{language.name} · {language.nativeName}</option>)}</select></label>
          <label className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#071631] p-3.5"><input type="checkbox" checked={preferences.automaticDetection} onChange={(event) => update({ automaticDetection: event.target.checked })} className="size-4 accent-blue-500" /><span><span className="block text-xs font-medium text-slate-200">Prefer automatic source detection</span><span className="mt-1 block text-[10px] text-slate-500">Requires a configured language-detection provider.</span></span></label>
        </div>
        <button type="button" onClick={persist} className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3.5 text-[11px] font-semibold text-white transition hover:bg-blue-500">{saved ? <Check aria-hidden="true" className="size-3.5" /> : null}{saved ? "Saved" : "Save preferences"}</button>
      </section>

      <section className="rounded-[20px] border border-white/[0.08] bg-[#0a1c3d] p-5 sm:p-6">
        <div className="flex items-center gap-2"><LockKeyhole aria-hidden="true" className="size-4 text-cyan-300" /><h2 className="text-sm font-semibold text-white">Privacy & data</h2></div>
        <p className="mt-2 max-w-3xl text-[11px] leading-5 text-slate-400">Completed KasaSpeech audio and transcripts are kept in this browser&apos;s IndexedDB. Translation and assistant prompts are sent to the server-configured provider only when you submit them. API keys are never placed in local storage.</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#071631] p-3.5">
          <span className="text-[11px] text-slate-300">{historyCount === null ? "Checking local records…" : `${historyCount} saved transcription${historyCount === 1 ? "" : "s"} in this browser`}</span>
          <button type="button" onClick={() => void clearHistory()} disabled={historyCount === null || historyCount === 0} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-300/15 px-2.5 text-[10px] font-medium text-rose-200 transition hover:bg-rose-300/[0.06] disabled:cursor-not-allowed disabled:opacity-40"><Trash2 aria-hidden="true" className="size-3.5" />Clear local history</button>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[10px] leading-5 text-amber-100/70"><CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />Do not place private credentials in browser preferences. For commercial multi-user deployments, add authentication and a tenant-isolated secrets store.</p>
      </section>
    </div>
  );
}
